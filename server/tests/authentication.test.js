const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApp } = require("../app");
const { readConfig } = require("../config/env");
const { fixtureEnv, fixtureConfig, http, login, email, password, proxySecret } = require("./auth-fixture");

const db = { status: () => ({ primary: "available", chat: "not_configured" }) };
const privileges = { "x-admin-proxy-key": proxySecret, "x-admin-client-ip": "192.0.2.20" };
async function setup(t, { production = false, env = {}, ...options } = {}) {
  const config = await fixtureConfig({ ...(production ? { NODE_ENV: "production", ADMIN_PROXY_SECRET: proxySecret } : {}), ...env });
  return http(t, createApp({ config, db, log: () => {}, ...options }));
}

test("startup requires an administrator, a password and a strong signing secret", async () => {
  const env = await fixtureEnv();
  for (const patch of [
    { ADMIN_PASSWORD_HASH: "invalid" },
    { ADMIN_PASSWORD_HASH: "", ADMIN_PASSWORD: "" },
    { ADMIN_EMAIL: "" },
    { ADMIN_SESSION_SECRET: "", JWT_SECRET: "" },
    { ADMIN_SESSION_SECRET: "too short" },
    { NODE_ENV: "production" },
  ]) assert.throws(() => readConfig({ ...env, ...patch }));
});

test("login verifies the exact password, binds a secure cookie, and fails closed", async (t) => {
  const request = await setup(t, { production: true });
  assert.equal((await login(request)).response.status, 403);
  const oversized = { email, password: "x".repeat(33 * 1024) };
  const direct = await login(request, { json: oversized });
  assert.equal(direct.response.status, 403);
  assert.equal(direct.payload.error.code, "PROXY_REQUIRED");
  const admitted = await login(request, { headers: privileges, json: oversized });
  assert.equal(admitted.response.status, 400);
  assert.equal((await login(request, { headers: { ...privileges, Origin: "https://elsewhere.example" } })).response.status, 403);
  assert.equal((await login(request, { headers: { ...privileges, Origin: "" } })).response.status, 403);
  assert.equal((await login(request, { headers: { ...privileges, "Sec-Fetch-Site": "cross-site" } })).response.status, 403);
  assert.equal((await login(request, { headers: privileges, json: { email, password: "x".repeat(257) } })).response.status, 400);
  assert.equal((await login(request, { headers: privileges, json: { email } })).response.status, 400);
  const invalid = await login(request, { headers: privileges, json: { email, password: password.trim() } });
  const outsider = await login(request, { headers: privileges, json: { email: "public@example.test", password } });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.setCookie, null);
  assert.equal(invalid.payload.error.message, outsider.payload.error.message);
  assert.equal((await request("/me", { headers: { ...privileges, Authorization: "Bearer old-fixture-token" } })).status, 401);
  assert.equal((await request("/me", { headers: privileges, cookie: "__Secure-portfolio_admin=invalid" })).status, 401);
  const granted = await login(request, { headers: privileges });
  assert.equal(granted.response.status, 200);
  assert.match(granted.setCookie, /^__Secure-portfolio_admin=/);
  for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=Strict/i, /Path=\/api\/admin/i, /Expires=/i]) assert.match(granted.setCookie, flag);
  assert.equal(granted.payload.data.administrator.email, email);
  assert.equal(granted.payload.data.session.storage, "signed-cookie");
  assert.equal(JSON.stringify(granted.payload).includes(granted.cookie.split("=")[1]), false);
  const me = await request("/me", { headers: privileges, cookie: granted.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.headers.get("cache-control"), "no-store");
  assert.equal((await request("/me", { cookie: granted.cookie })).status, 403);
});

test("the legacy plaintext ADMIN_PASSWORD is verified through an in-memory Argon2id hash", async (t) => {
  const hashed = [];
  const request = await setup(t, {
    env: { ADMIN_PASSWORD_HASH: "", ADMIN_PASSWORD: password },
    hash: async (value) => { hashed.push(value); return require("../auth/password").hashPassword(value); },
  });
  assert.equal((await login(request, { json: { email, password: "wrong fixture password" } })).response.status, 401);
  assert.equal((await login(request)).response.status, 200);
  assert.equal(hashed.length, 1);
});

test("sessions are signed, expire, and are bound to the signing secret and credential", async (t) => {
  let clock = Date.now();
  const request = await setup(t, { now: () => clock });
  const session = await login(request);
  assert.equal((await request("/me", { cookie: session.cookie })).status, 200);
  const [name, token] = session.cookie.split("=");
  const [payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  const forged = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 86_400_000 })).toString("base64url");
  assert.equal((await request("/me", { cookie: name + "=" + forged + "." + signature })).status, 401);
  assert.equal((await request("/me", { cookie: session.cookie + "; " + session.cookie })).status, 401);
  const rotatedSecret = await setup(t, { now: () => clock, env: { ADMIN_SESSION_SECRET: "rotated-fixture-session-secret-0123456789" } });
  assert.equal((await rotatedSecret("/me", { cookie: session.cookie })).status, 401);
  const rotatedPassword = await setup(t, { now: () => clock, env: { ADMIN_PASSWORD_HASH: "", ADMIN_PASSWORD: "rotated fixture password" } });
  assert.equal((await rotatedPassword("/me", { cookie: session.cookie })).status, 401);
  clock += 8 * 60 * 60_000 - 1000;
  assert.equal((await request("/me", { cookie: session.cookie })).status, 200);
  clock += 2000;
  assert.equal((await request("/me", { cookie: session.cookie })).status, 401);
});

test("logout requires origin and CSRF verification and clears the cookie", async (t) => {
  const request = await setup(t);
  const session = await login(request);
  assert.equal((await request("/logout", { method: "POST", cookie: session.cookie })).status, 403);
  assert.equal((await request("/logout", { method: "POST", cookie: session.cookie, csrf: "x".repeat(43) })).status, 403);
  assert.equal((await request("/logout", { method: "POST", cookie: session.cookie, csrf: session.csrf, headers: { Origin: "https://elsewhere.example" } })).status, 403);
  const done = await request("/logout", { method: "POST", cookie: session.cookie, csrf: session.csrf });
  assert.equal(done.status, 200);
  assert.match(done.headers.get("set-cookie"), /portfolio_admin=;.*Expires=Thu, 01 Jan 1970/i);
  assert.equal((await request("/logout", { method: "POST" })).status, 200);
});

test("every retained private resource rejects anonymous and client-supplied roles", async (t) => {
  const request = await setup(t);
  for (const path of ["/me", "/stats", "/system", "/contacts", "/users", "/transactions", "/chats", "/chat-analytics"]) {
    for (const headers of [{}, { Authorization: "Bearer fixture" }, { "X-Admin-Role": "owner" }]) {
      const response = await request(path, { headers });
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});

test("login rate limiting is bounded per network and resets after the window", async (t) => {
  let clock = Date.UTC(2026, 0, 1);
  const request = await setup(t, { now: () => clock });
  const wrong = { email, password: "wrong fixture password" };
  for (let attempt = 0; attempt < 8; attempt++) assert.equal((await login(request, { json: wrong })).response.status, 401);
  const limited = await login(request, { json: wrong });
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
  assert.equal((await login(request)).response.status, 429);
  clock += 5 * 60_000;
  assert.equal((await login(request)).response.status, 200);
});

test("no administrator write reaches business data", async (t) => {
  const request = await setup(t);
  const { cookie, csrf } = await login(request);
  for (const [method, path] of [["POST", "/contacts"], ["PATCH", "/contacts/507f1f77bcf86cd799439011"], ["DELETE", "/newsletters/507f1f77bcf86cd799439011"],
    ["PUT", "/transactions/507f1f77bcf86cd799439011"], ["POST", "/chats/bulk-delete"], ["DELETE", "/chats/507f1f77-0000-4000-8000-000000000001"], ["POST", "/system"]]) {
    const response = await request(path, { method, cookie, csrf });
    assert.ok(response.status >= 400 && response.status < 500, method + " " + path);
  }
});
