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

test("provisioning adds only the required Admin collections and indexes to an existing Portfolio database", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const { client, primary } = await createMongoFixture();
  t.after(() => client.close());
  const { provisionSecurityStore } = require("../scripts/provision-admin-security");
  await primary.collection("contacts").insertOne({ _id: "existing-contact" });
  await primary.collection("contacts").createIndex({ name: 1 });
  await primary.createCollection("admin_security_audit");
  await primary.collection("admin_security_audit").createIndex({ createdAt: -1 }, { name: "existing_audit_sort" });
  assert.equal(await provisionSecurityStore(primary), 5);
  const list = async () => (await primary.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
  assert.deepEqual(await list(), ["admin_auth_limits", "admin_security_audit", "admin_sessions", "contacts"]);
  const sessions = await primary.collection("admin_sessions").indexes();
  assert.ok(sessions.some(({ key, unique }) => key.tokenHash === 1 && unique));
  assert.ok(sessions.some(({ key, expireAfterSeconds }) => key.expiresAt === 1 && expireAfterSeconds === 0));
  assert.equal(await provisionSecurityStore(primary), 0);
  assert.deepEqual(await primary.collection("contacts").findOne(), { _id: "existing-contact" });
  assert.deepEqual((await primary.collection("contacts").indexes()).map(({ name }) => name), ["_id_", "name_1"]);
  assert.ok((await primary.collection("admin_security_audit").indexes()).some(({ name }) => name === "existing_audit_sort"));
});

test("provisioning refuses an unknown database, conflicting indexes, and TTL on stored records", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const { client, primary } = await createMongoFixture();
  t.after(() => client.close());
  const { provisionSecurityStore } = require("../scripts/provision-admin-security");
  const unknown = client.db(primary.databaseName + "_unknown");
  await assert.rejects(() => provisionSecurityStore(unknown), /existing Portfolio/);
  assert.deepEqual(await unknown.listCollections().toArray(), []);
  const rates = await primary.createCollection("admin_auth_limits");
  await rates.createIndex({ expiresAt: 1 });
  await assert.rejects(() => provisionSecurityStore(primary), /conflicting index/);
  assert.equal(await primary.listCollections({ name: "admin_sessions" }).hasNext(), false);
  await rates.dropIndex("expiresAt_1");
  await rates.insertOne({ _id: "existing-counter", expiresAt: new Date(0) });
  await assert.rejects(() => provisionSecurityStore(primary), /existing records/);
  assert.equal(await rates.countDocuments(), 1);
  assert.equal(await primary.listCollections({ name: "admin_sessions" }).hasNext(), false);
});
