const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApp } = require("../app");
const { readConfig } = require("../config/env");
const { fixtureEnv, fixtureConfig, fixtureStore, http, login, email, password, origin, proxySecret } = require("./auth-fixture");

const db = { status: () => ({ primary: "available", chat: "not_configured", admin: "available" }) };
const privileges = { "x-admin-proxy-key": proxySecret, "x-admin-client-ip": "192.0.2.20" };
async function setup(t, { store = fixtureStore(), production = false, ...options } = {}) {
  const config = await fixtureConfig(production ? { NODE_ENV: "production", ADMIN_PROXY_SECRET: proxySecret } : {});
  const request = await http(t, createApp({ config, store, db, log: () => {}, ...options }));
  return { request, store };
}

test("startup requires valid hashed credentials and a valid admin store", async () => {
  const env = await fixtureEnv();
  for (const patch of [
    { ADMIN_PASSWORD_HASH: "", ADMIN_PASSWORD: password, JWT_SECRET: "obsolete fixture" },
    { ADMIN_PASSWORD_HASH: "invalid" },
    { ADMIN_EMAIL: "" },
    { ADMIN_DB_NAME: "wrong_database" },
    { ADMIN_MONGODB_URI: "" },
    { ADMIN_MONGODB_URI: env.PORTFOLIO_MONGODB_URI, ADMIN_DB_NAME: env.PORTFOLIO_DB_NAME },
    { NODE_ENV: "production" },
  ]) assert.throws(() => readConfig({ ...env, ...patch }));
});

test("login verifies the exact password, binds a secure cookie, and fails closed", async (t) => {
  const { request, store } = await setup(t, { production: true });
  assert.equal((await login(request)).response.status, 403);
  const oversized = { email, password: "x".repeat(33 * 1024) };
  const direct = await login(request, { json: oversized });
  assert.equal(direct.response.status, 403);
  assert.equal(direct.payload.error.code, "PROXY_REQUIRED");
  const admitted = await login(request, { headers: privileges, json: oversized });
  assert.equal(admitted.response.status, 400);
  assert.equal(admitted.payload.error.code, "VALIDATION_ERROR");
  assert.equal((await login(request, { headers: { ...privileges, Origin: "https://elsewhere.example" } })).response.status, 403);
  assert.equal((await login(request, { headers: { ...privileges, Origin: "" } })).response.status, 403);
  assert.equal((await login(request, { headers: privileges, json: { email, password: "x".repeat(257) } })).response.status, 400);
  assert.equal((await login(request, { headers: privileges, json: { email } })).response.status, 400);
  const invalid = await login(request, { headers: privileges, json: { email, password: password.trim() } });
  const outsider = await login(request, { headers: privileges, json: { email: "public@example.test", password } });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.payload.error.message, outsider.payload.error.message);
  assert.equal((await request("/me", { headers: { ...privileges, Authorization: "Bearer old-fixture-token" } })).status, 401);
  assert.equal((await request("/me", { headers: privileges, cookie: "invalid" })).status, 401);
  const granted = await login(request, { headers: privileges });
  assert.equal(granted.response.status, 200);
  assert.match(granted.setCookie, /^__Secure-portfolio_admin=/);
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/api/admin", "Expires="]) assert.ok(granted.setCookie.includes(attribute));
  assert.doesNotMatch(granted.setCookie, /Domain=/i);
  assert.equal(granted.payload.data.administrator.email, email);
  const raw = granted.cookie.split("=")[1];
  assert.equal(JSON.stringify(granted.payload).includes(raw), false);
  assert.equal(JSON.stringify([...store.sessions.values()]).includes(raw), false);
  assert.equal(JSON.stringify([...store.audits.values()]).includes(password), false);
  assert.equal((await request("/me", { headers: privileges, cookie: granted.cookie })).status, 200);
  assert.equal((await request("/me", { headers: privileges, cookie: granted.cookie + "; " + granted.cookie })).status, 401);
  store.setAvailable(false);
  assert.equal((await request("/me", { headers: privileges, cookie: granted.cookie })).status, 503);
  assert.equal((await login(request, { headers: privileges })).response.status, 503);
});

test("sessions rotate, can be terminated individually or in bulk, and require CSRF", async (t) => {
  const { request, store } = await setup(t);
  const a = await login(request);
  const b = await login(request, { cookie: a.cookie });
  assert.notEqual(a.cookie, b.cookie);
  assert.equal((await request("/me", { cookie: a.cookie })).status, 401);
  const c = await login(request);
  const d = await login(request);
  const list = await (await request("/sessions", { cookie: d.cookie })).json();
  assert.equal(list.data.items.length, 3);
  assert.ok(list.data.items.every((item) => !item.tokenHash && item.id));
  assert.equal((await request("/sessions/revoke-others", { method: "POST", cookie: d.cookie })).status, 403);
  assert.equal((await request("/logout", { method: "POST", cookie: d.cookie, csrf: "incorrect" })).status, 403);
  assert.equal((await request("/logout", { method: "POST", cookie: d.cookie, csrf: d.csrf, headers: { Origin: "https://public.example.test" } })).status, 403);
  assert.equal((await request("/sessions/" + c.payload.data.session.id, { method: "DELETE", cookie: d.cookie, csrf: d.csrf })).status, 200);
  assert.equal((await request("/me", { cookie: c.cookie })).status, 401);
  const others = await request("/sessions/revoke-others", { method: "POST", cookie: d.cookie, csrf: d.csrf });
  assert.equal((await others.json()).data.revoked, 1);
  assert.equal((await request("/me", { cookie: b.cookie })).status, 401);
  assert.equal((await request("/me", { cookie: d.cookie })).status, 200);
  const all = await request("/sessions/revoke-all", { method: "POST", cookie: d.cookie, csrf: d.csrf });
  assert.equal(all.status, 200);
  assert.match(all.headers.get("set-cookie"), /Path=\/api\/admin.*Expires=Thu, 01 Jan 1970/);
  assert.equal((await request("/me", { cookie: d.cookie })).status, 401);
  const active = await login(request);
  assert.equal((await request("/logout", { method: "POST", cookie: active.cookie, csrf: active.csrf })).status, 200);
  assert.equal((await request("/me", { cookie: active.cookie })).status, 401);
  assert.equal((await request("/logout", { method: "POST", cookie: active.cookie })).status, 200);
  assert.ok([...store.audits.values()].some((event) => event.type === "logout" && event.result === "completed"));
});

test("every retained private resource rejects anonymous and client-supplied roles", async (t) => {
  const { request } = await setup(t);
  for (const path of ["me", "sessions", "system", "stats", "contacts", "newsletters", "bookings", "chats",
    "support-payments", "transactions", "users", "activity", "webhook-events", "blog-posts", "blog-supports"]) {
    const response = await request("/" + path, { headers: { "X-Admin-Role": "owner" } });
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("idle expiry and absolute expiry are enforced before MongoDB TTL cleanup", async (t) => {
  let clock = Date.now();
  const { request, store } = await setup(t, { now: () => clock });
  const a = await login(request);
  clock += 29 * 60_000;
  const touched = await (await request("/me", { cookie: a.cookie })).json();
  assert.ok(new Date(touched.data.session.idleExpiresAt) > new Date(a.payload.data.session.idleExpiresAt));
  clock += 30 * 60_000;
  assert.equal((await request("/me", { cookie: a.cookie })).status, 401);
  const b = await login(request);
  const row = store.sessions.get(b.payload.data.session.id);
  row.expiresAt = new Date(clock + 1000);
  clock += 1000;
  assert.equal((await request("/me", { cookie: b.cookie })).status, 401);
  assert.equal(store.sessions.size, 2);
  assert.equal([...store.audits.values()].filter((event) => event.type === "session_expired").length, 2);
});

test("rate limiting is shared, bounded and resets after the window", async (t) => {
  let clock = Date.now();
  const store = fixtureStore();
  const options = { store, now: () => clock, production: true };
  const a = (await setup(t, options)).request;
  const b = (await setup(t, options)).request;
  const wrong = { headers: privileges, json: { email, password: "wrong fixture password" } };
  for (let i = 0; i < 8; i++) {
    assert.equal((await login(i % 2 ? a : b, wrong)).response.status, 401);
  }
  const blocked = await login(b, wrong);
  assert.equal(blocked.response.status, 429);
  assert.ok(Number(blocked.response.headers.get("retry-after")) > 0);
  assert.equal((await login(a, { ...wrong, headers: { ...privileges, "x-admin-client-ip": "192.0.2.21" } })).response.status, 401);
  assert.ok([...store.audits.values()].some((event) => event.type === "login_rate_limited"));
  clock += 5 * 60_000;
  const bucket = Math.floor(clock / 300_000);
  store.counters.set("owner:" + bucket, 20);
  assert.equal((await login(a, { headers: privileges })).response.status, 429);
  store.counters.delete("owner:" + bucket);
  store.counters.set("global:" + bucket, 60);
  assert.equal((await login(a, { headers: privileges })).response.status, 429);
  clock += 5 * 60_000;
  assert.equal((await login(a, { headers: privileges })).response.status, 200);
});

test("credential rotation invalidates existing sessions without changing shared records", async (t) => {
  const { request, store } = await setup(t);
  const previous = await login(request);
  const { hashPassword } = require("../auth/password");
  const config = await fixtureConfig({ ADMIN_PASSWORD_HASH: await hashPassword(" new rotation fixture password ") });
  const rotated = await http(t, createApp({ config, store, db, log: () => {} }));
  assert.equal((await rotated("/me", { cookie: previous.cookie })).status, 401);
  assert.equal((await login(rotated)).response.status, 401);
  assert.equal((await login(rotated, { json: { email, password: " new rotation fixture password " } })).response.status, 200);
});
