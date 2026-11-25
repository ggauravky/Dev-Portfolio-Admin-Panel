const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApp } = require("../app");
const { fixtureConfig, http, login } = require("./auth-fixture");

test("business reports require an admin session and isolate unavailable sources", async (t) => {
  const db = { get: () => null, status: () => ({ primary: "unavailable", chat: "not_configured" }) };
  const request = await http(t, createApp({ config: await fixtureConfig(), db, log: () => {} }));
  assert.equal((await request("/business-analytics")).status, 401);
  const { cookie, csrf } = await login(request);
  const report = await request("/business-analytics?range=7d", { cookie });
  assert.equal(report.status, 200);
  assert.equal(report.headers.get("cache-control"), "no-store");
  assert.equal((await report.json()).data.users.status, "unavailable");
  assert.equal((await request("/business-analytics?range=invalid", { cookie })).status, 400);
  assert.equal((await request("/contacts", { method: "POST", cookie, csrf })).status, 403);
  assert.equal((await request("/audit-events", { cookie })).status, 404);
  assert.equal((await request("/users/507f1f77bcf86cd799439011/transactions", { method: "DELETE", cookie, csrf })).status, 403);
});
