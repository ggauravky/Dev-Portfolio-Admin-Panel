const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createMongoFixture } = require("./mongo-fixture");
const { createDatabases } = require("../config/database");
const { createSecurityStore } = require("../auth/store");
const { createApp } = require("../app");
const { http, login } = require("./auth-fixture");

test("Mongo security indexes, atomic counters and revocation with two app instances", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const { client, security, config } = await createMongoFixture();
  t.after(() => client.close());
  const pools = [createDatabases(config), createDatabases(config)];
  t.after(() => Promise.all(pools.map((db) => db.close())));
  const [first, second] = await Promise.all(pools.map((db) => http(t, createApp({ config, db, log: () => {} }))));
  const session = await login(first);
  assert.equal(session.response.status, 200);
  assert.equal((await second("/me", { cookie: session.cookie })).status, 200);
  const rows = await security.collection("admin_sessions").find({}).toArray();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].tokenHash, session.cookie.split("=")[1]);
  assert.equal((await second("/logout", { method: "POST", cookie: session.cookie, csrf: session.csrf })).status, 200);
  assert.equal((await first("/me", { cookie: session.cookie })).status, 401);
  const expiry = new Date(Date.now() + 60_000);
  const reservations = await Promise.all(Array.from({ length: 16 }, (_, index) => createSecurityStore(pools[index % 2]).reserve("fixture-race", 5, expiry)));
  assert.equal(reservations.filter(Boolean).length, 5);
  assert.equal(await security.collection("admin_auth_limits").countDocuments({ _id: "fixture-race" }), 1);
  assert.equal(await security.collection("admin_security_audit").countDocuments({ type: "logout", result: "completed" }), 1);
  const incomplete = { ...config, admin: { ...config.admin, name: config.admin.name + "_unprovisioned" } };
  const unavailable = createDatabases(incomplete);
  t.after(() => unavailable.close());
  const third = await http(t, createApp({ config: incomplete, db: unavailable, log: () => {} }));
  assert.equal((await login(third)).response.status, 503);
});
