const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { fixtureEnv, fixtureStore, email, password, origin } = require("./auth-fixture");

test("configuration binds explicitly and rejects ambiguous database identities", async () => {
  const { readConfig } = require("../config/env");
  const env = await fixtureEnv();
  assert.equal(readConfig(env).primary.name, "fixture");
  for (const overrides of [
    { PORTFOLIO_MONGODB_URI: "" },
    { MONGO_URI: "mongodb://localhost/other" },
    { PORTFOLIO_DB_NAME: "other" },
    { PORTFOLIO_MONGODB_URI: "mongodb://localhost", PORTFOLIO_DB_NAME: "" },
  ]) assert.throws(() => readConfig({ ...env, ...overrides }));
  assert.equal(readConfig({ ...env, PORTFOLIO_MONGODB_URI: "", MONGO_URI: "mongodb://localhost/fixture", PORTFOLIO_DB_NAME: "" }).primary.name, "fixture");
});

test("full app protects reads and isolates unavailable chat and financial writes", async (t) => {
  const { createApp } = require("../app");
  const { readConfig } = require("../config/env");
  const calls = [];
  const db = {
    status: () => ({ primary: "available", chat: "not_configured", admin: "available" }),
    hasCollection: (key, name) => key === "primary" && name !== "paymentwebhookevents",
    get: (name) => name === "primary" ? {
      collection: () => ({
        countDocuments: async () => 51,
        find: (filter, options) => {
          calls.push({ filter, options });
          return { sort() { return this; }, skip() { return this; }, limit() { return this; }, async toArray() { return []; } };
        },
      }),
    } : null,
  };
  const server = createApp({ config: readConfig(await fixtureEnv()), db, store: fixtureStore(), log: () => {} }).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + "/api/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const request = (path, method = "GET") => fetch(base + "/api/admin" + path, {
    method, headers: { Cookie: cookie, "X-Request-Id": "fixture-request" },
  });
  assert.equal((await fetch(base + "/api/admin/contacts")).status, 401);
  assert.equal((await fetch(base + "/ready")).status, 200);
  assert.equal((await request("/chats")).status, 503);
  assert.equal((await request("/webhook-events")).status, 503);
  assert.equal((await request("/chats/not-a-uuid")).status, 400);
  assert.equal((await request("/contacts/not-an-object-id")).status, 400);
  assert.equal((await request("/contacts?limit=101")).status, 400);
  assert.equal((await request("/contacts?limit=25abc")).status, 400);
  assert.equal((await request("/contacts?sortBy=ipAddress")).status, 400);
  assert.equal((await request("/contacts?status=all")).status, 400);
  assert.equal((await request("/contacts?from=2026-02-29")).status, 400);
  assert.equal((await request("/contacts?search%5B%24ne%5D=x")).status, 400);
  assert.equal((await request("/bookings/507f1f77bcf86cd799439011", "DELETE")).status, 403);
  assert.equal((await request("/support-payments/bulk-delete", "POST")).status, 403);
  assert.equal((await request("/mllogs")).status, 404);
  const response = await request("/contacts?search=%2Ea&page=2");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), "fixture-request");
  const { data } = await response.json();
  assert.deepEqual(data, { items: [], total: 51, page: 2, pageSize: 25, totalPages: 3 });
  assert.equal(calls[0].filter.$or[0].name.$regex, "\\.a");
  assert.equal(calls[0].options.projection.ipAddress, undefined);
  await request("/support-payments?status=paid");
  assert.deepEqual(calls[1].filter, { flowType: "support", status: "paid" });
  const stats = await (await request("/stats")).json();
  assert.equal(stats.totalContacts, 51);
  assert.equal(stats.totalChats, null);
  assert.equal((await request("/system")).status, 200);
  assert.equal((await request("/newsletters/507f1f77bcf86cd799439011", "PUT")).status, 403);
});

test("pools verify existing collections, isolate errors, recover after cooldown and close", async () => {
  const { createDatabases } = require("../config/database");
  const { readConfig } = require("../config/env");
  const config = readConfig(await fixtureEnv({ CHAT_MONGODB_URI: "mongodb://localhost/portfolio_chat" }));
  delete config.admin; // This fixture covers only the Phase 2 pools.
  const selected = [];
  const instances = [];
  let chatAvailable = false;
  let primaryAvailable = true;
  let time = 0;
  class Client {
    constructor(uri, options) { this.options = options; instances.push(this); }
    async connect() {}
    db(name) {
      selected.push(name);
      return { databaseName: name, listCollections: () => ({ toArray: async () => {
        if (name === "portfolio_chat" && !chatAvailable) throw new Error("private socket details");
        if (name === "fixture" && !primaryAvailable) return [];
        return [{ name: name === "portfolio_chat" ? "chat_turns" : "contacts" }];
      } }) };
    }
    async close() { this.closed = true; }
  }
  const events = [];
  const db = createDatabases(config, { Client, now: () => time, log: (event) => events.push(event) });
  await Promise.all([db.connect("primary"), db.connect("primary"), db.connect("chat")]);
  assert.deepEqual(selected, ["fixture", "portfolio_chat"]);
  assert.deepEqual(db.status(), { primary: "available", chat: "unavailable" });
  assert.equal(db.hasCollection("primary", "contacts"), true);
  assert.equal(db.hasCollection("primary", "users"), false);
  assert.equal(instances[0].options.maxPoolSize, 8);
  assert.equal(JSON.stringify(events).includes("private socket"), false);
  await db.connect("chat");
  assert.equal(instances.length, 2);
  time += 31_000;
  chatAvailable = true;
  primaryAvailable = false;
  await Promise.all([db.connect("primary"), db.connect("chat")]);
  assert.deepEqual(db.status(), { primary: "unavailable", chat: "available" });
  await db.close();
  assert.ok(instances.every(({ closed }) => closed));
  await db.connect("chat");
  assert.equal(db.get("chat"), null);
});

test("contract pins the canonical models and fails when evidence is missing or changed", (t) => {
  const { differences } = require("../contracts/verify");
  const { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require("node:fs");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");
  const { createHash } = require("node:crypto");
  const { collections, retention } = require("../contracts/portfolio-schema.json");
  const dir = mkdtempSync(join(tmpdir(), "admin-contract-"));
  const file = join(dir, "model.js");
  t.after(() => { unlinkSync(file); rmdirSync(dir); });
  const source = 'enum: ["paid"]\n';
  const pinned = { "model.js": createHash("sha256").update(source).digest("hex") };
  assert.deepEqual(differences(dir, pinned), ["model.js missing or unreadable"]);
  writeFileSync(file, source.replace("\n", "\r\n"));
  assert.deepEqual(differences(dir, pinned), []);
  writeFileSync(file, 'enum: ["paid", "refunded"]');
  assert.deepEqual(differences(dir, pinned), ["model.js changed"]);
  assert.equal(collections.contacts.fields.name.required, true);
  assert.equal(collections.newsletters.indexes.some(([key, options]) => key.email === 1 && options.unique), true);
  assert.equal(collections.bookings.fields.userId.ref, "users");
  assert.deepEqual(collections.paymenttransactions.fields.flowType.enum, ["service", "support"]);
  assert.equal(collections.paymenttransactions.fields.amountPaise.type, "Number");
  assert.equal(collections.chat_turns.fields._id.type, "UUID");
  assert.equal(retention.chat_turnsDays, 180);
});
