const { test } = require("node:test");
const assert = require("node:assert/strict");
const { HttpError } = require("../utils/http");

test("reporting windows use IST calendar boundaries and enforce retention", () => {
  const { reportingRange } = require("../chat/query");
  const now = new Date("2026-11-24T20:00:00Z");
  const today = reportingRange({ range: "today" }, now);
  assert.equal(today.from.toISOString(), "2026-11-24T18:30:00.000Z");
  assert.equal(today.to.toISOString(), "2026-11-25T18:30:00.000Z");
  assert.throws(() => reportingRange({ from: "2025-01-01", to: "2026-11-25" }, now));
  assert.throws(() => reportingRange({ from: "2026-11-25", to: "2026-11-24" }, now));
});

test("corpus synchronization drops vectors and validates links; resolution is version scoped", () => {
  const { manifestFrom, safeSourceUrl } = require("../scripts/chat-manifest");
  const { resolveSources } = require("../chat/knowledge");
  const index = require("../contracts/portfolio-chat-corpus.json");
  const one = manifestFrom({ version: index.version, model: "fixture", dim: 2, builtAt: index.builtAt, chunks: [
    { id: "example#1", type: "blog", title: "Fixture source", url: "/blog", vec: [1, 2], text: "Hidden" },
  ] }, index.sourceRevision);
  assert.deepEqual(one.chunks[0], { id: "example#1", type: "blog", title: "Fixture source", group: null, url: "https://ggauravky.vercel.app/blog" });
  for (const url of ["javascript:alert(1)", "//elsewhere.example", "https://ggauravky.vercel.app@elsewhere.example/", "https://github.com/another-owner"]) {
    assert.equal(safeSourceUrl(url), null);
  }
  const id = index.chunks[0].id;
  assert.equal(resolveSources(index.version, [id])[0].mapping, "verified");
  assert.deepEqual(resolveSources("unknown-version", [id]), [{ id, mapping: "unavailable" }]);
  assert.deepEqual(resolveSources(index.version, ["unknown-id"]), [{ id: "unknown-id", mapping: "unavailable" }]);
});

test("optional database permissions are isolated and raw database errors are sanitized", async () => {
  const { createChatAccess } = require("../chat/access");
  const { createOperations, currentWindows } = require("../chat/operations");
  const now = () => new Date("2026-11-25T13:45:08Z");
  const db = {
    status: () => ({ chat: "available" }),
    hasCollection: (_, name) => name !== "chat_cache",
    get: () => ({ collection: (name) => {
      assert.equal(name, "chat_rate");
      return { find() { throw Object.assign(new Error("private database connection detail"), { code: 13 }); } };
    } }),
  };
  // Keep locks independently authorized in this fixture, with no cooldown row.
  const get = db.get;
  db.get = () => ({ collection: (name) => name === "chat_locks"
    ? { find: () => ({ limit: () => ({ toArray: async () => [] }) }) }
    : get().collection(name) });
  const report = await createOperations(createChatAccess(db), db, now)();
  assert.equal(report.quota.code, "CHAT_PERMISSION");
  assert.equal(report.cacheEntries.code, "CHAT_COLLECTION_UNAVAILABLE");
  assert.equal(report.cooldowns.data[0].status, "not_observed");
  assert.doesNotMatch(JSON.stringify(report), /private database|q:groq/);
  const daily = currentWindows(now()).find((row) => row.label === "groq" && row.metric === "rpd");
  assert.equal(new Date(daily.windowStart).toISOString(), "2026-11-25T00:00:00.000Z");
});

test("partial analytics preserve successful volume, and timeouts are explicit", async () => {
  const { createAnalytics } = require("../chat/analytics");
  const { createChatAccess } = require("../chat/access");
  const now = () => new Date("2026-11-25T13:45:00Z");
  let invocations = 0;
  const analytics = createAnalytics({ aggregate: async (stages) => {
    invocations++;
    if (stages.at(-1).$facet.bins) throw new HttpError(503, "CHAT_TIMEOUT", "Timed out");
    return [{ totals: [{ turns: 2 }], conversations: [{ count: 2 }] }];
  } }, now);
  const response = await analytics.full({});
  assert.equal(response.core.data.turns, 2);
  assert.equal(response.latency.code, "CHAT_TIMEOUT");
  await analytics.full({});
  assert.equal(invocations, 3); // Success cached; the failed section retries.
  const timeout = createChatAccess({
    get: () => ({ collection: () => ({ aggregate: () => ({ toArray() { throw Object.assign(new Error("private timeout"), { code: 50 }); } }) }) }),
  });
  await assert.rejects(timeout.aggregate([]), (error) => error.code === "CHAT_TIMEOUT" && !error.message.includes("private timeout"));
});

test("Phase 3 sessions protect every intelligence endpoint, including expired and tampered sessions", async (t) => {
  const { createApp } = require("../app");
  const { fixtureConfig, http, login } = require("./auth-fixture");

  let clock = Date.now();
  const request = await http(t, createApp({ config: await fixtureConfig(), now: () => clock,
    db: { status: () => ({ chat: "not_configured" }), get: () => null }, log: () => {} }));
  const paths = ["/chat-analytics", "/chat-conversations", "/chat-conversations/507f1f77-0000-4000-8000-000000000001",
    "/chats", "/chats/507f1f77-0000-4000-8000-000000000001", "/chat-operations", "/chat-knowledge"];
  const expired = await login(request);
  const [name, token] = expired.cookie.split("=");
  const tampered = name + "=" + token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
  clock += 8 * 60 * 60000 + 1;
  for (const path of paths) {
    for (const input of [{}, { headers: { Authorization: "Bearer obsolete-fixture" } }, { cookie: expired.cookie }, { cookie: tampered }]) {
      const response = await request(path, input);
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});

test("production proxy admission applies to intelligence routes even with a valid session", async (t) => {
  const { createApp } = require("../app");
  const { fixtureConfig, http, login, proxySecret } = require("./auth-fixture");
  const config = await fixtureConfig({ NODE_ENV: "production", ADMIN_PROXY_SECRET: proxySecret });
  const request = await http(t, createApp({ config,
    db: { status: () => ({ chat: "not_configured" }), get: () => null }, log: () => {} }));
  const headers = { "X-Admin-Proxy-Key": proxySecret };
  const { cookie } = await login(request, { headers });
  assert.ok(cookie);
  assert.equal((await request("/chat-knowledge", { cookie })).status, 403);
  const trusted = await request("/chat-knowledge", { cookie, headers });
  assert.equal(trusted.status, 200);
  assert.equal((await trusted.json()).data.observations.code, "CHAT_NOT_CONFIGURED");
});
