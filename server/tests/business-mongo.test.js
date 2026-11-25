const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApp } = require("../app");
const { createDatabases } = require("../config/database");
const { login, http } = require("./auth-fixture");
const { createMongoFixture } = require("./mongo-fixture");
const { businessFixture, id, now, today } = require("./business-fixture");

test("isolated MongoDB verifies business records, analytics and read-only access", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const fixture = await businessFixture();
  const db = createDatabases(fixture.config);
  t.after(async () => { await db.close(); await fixture.client.close(); });
  const request = await http(t, createApp({ config: fixture.config, db, businessNow: now, financialNow: now, log: () => {} }));
  const owner = await login(request, { headers: { "X-Request-Id": "business-owner-fixture" } });
  assert.equal(owner.response.status, 200);
  const get = async (path, expected = 200) => {
    const response = await request(path, { cookie: owner.cookie });
    const value = await response.json();
    assert.equal(response.status, expected, path + " " + JSON.stringify(value).slice(0, 200));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(value), /withheld-|tokenHash|credentialVersion|supporterSnapshot|avatarPublicId/);
    return value.data ?? value;
  };
  assert.equal((await get("/users?search=alice&emailVerified=true")).items[0].displayName, "Fixture Alice");
  assert.equal((await get("/users?emailVerified=unknown")).total, 1);
  assert.equal((await get("/users?from=2026-11-25&to=2026-11-25&dateField=lastLoginAt")).total, 2);
  assert.equal((await get("/users?signupFrom=2026-11-25&signupTo=2026-11-25&loginFrom=2026-11-25&loginTo=2026-11-25")).total, 1);
  assert.equal((await get("/users/" + id(401))).welcomeEmailSentCount, 1);
  assert.equal((await get(`/users/${id(401)}/transactions`)).items[0]._id, String(id(461)));
  assert.equal((await get(`/users/${id(401)}/bookings`)).total, 1);
  assert.equal((await get(`/users/${id(401)}/blog-supports`)).total, 2);
  assert.equal((await get(`/users/${id(401)}/activity`)).total, 2);
  await get(`/users/${id(401)}/activity?userId=${id(402)}`, 400);
  await get("/users/unknown", 400);
  assert.equal((await get("/contacts?pageSize=5&page=2")).items.length, 2);
  const contacts = await get("/contacts?status=unread&search=searchable&range=today");
  assert.equal(contacts.total, 1);
  assert.match(contacts.items[0].preview, /<img/);
  assert.equal(contacts.items[0].message, undefined);
  assert.match((await get("/contacts/" + id(411))).message, /Fixture searchable message/);
  assert.equal((await fixture.primary.collection("contacts").findOne({ _id: id(411) })).status, "unread");
  assert.equal((await get("/newsletters?subscribed=unknown")).items[0].email, "unknown@example.test");
  assert.equal((await get("/newsletters?subscribed=false&dateField=unsubscribedAt&range=today")).total, 1);
  assert.equal((await get("/newsletters/" + id(421))).subscribedAt, "2026-11-24T18:29:59.000Z");
  const article = (await get("/blog-posts")).items[0];
  assert.equal(article.publicUrl, "https://ggauravky.vercel.app/blog/uber-system-design");
  assert.equal(article.actualSupportCount, 1);
  assert.equal(article.consistency, "counter_mismatch");
  const orphan = await get("/blog-supports/" + id(442));
  assert.equal(orphan.article.snapshotTitle, "Historical fixture article");
  assert.equal(orphan.user.state, "missing");
  assert.equal((await get("/blog-supports/" + id(441))).article.snapshotMismatch, true);
  const event = (await get(`/activity?userId=${id(401)}&actionType=payment_success`)).items[0];
  assert.equal(event.transaction.id, String(id(461)));
  assert.equal((await get("/activity?actionType=unclassified")).items[0].transaction.state, "ownership_unverified");
  assert.equal((await get("/activity?domain=payment&status=success")).items[0].createdAt, today.toISOString());
  const report = await get("/business-analytics?range=today");
  assert.equal(report.dates.from, today.toISOString());
  assert.equal(report.users.data.total, 3);
  assert.equal(report.users.data.registrations, 1);
  assert.equal(report.users.data.lastLoginInPeriod, 2);
  assert.equal(report.contacts.data.total, 7);
  assert.equal(report.contacts.data.received, 1);
  assert.equal(report.newsletter.data.active, 1);
  assert.equal(report.newsletter.data.unknown, 1);
  assert.equal(report.newsletter.data.unsubscribeTimestamps, 1);
  assert.equal(report.engagement.data.total, 3);
  assert.equal(report.engagement.data.distinctSupporterIds, 2);
  assert.equal(report.engagement.data.supportedArticles, 1);
  assert.equal(report.engagement.data.top[0].id, String(id(431)));
  assert.equal(report.activity.data.linkedUsers.data, 1);
  assert.equal(report.timeline.filter((event) => event.source === "transactions").length, 1);
  const priorReport = await get("/business-analytics?from=2026-11-01&to=2026-11-01");
  assert.equal(priorReport.users.data.registrations, 0);
  assert.equal(priorReport.users.data.total, 3);
  assert.equal((await get("/stats")).totalNewsletters, 1);
  assert.equal((await get("/system")).optionalCollections.supportpayments, "unknown");

  for (const [path, method] of [["/contacts/" + id(411), "PATCH"], ["/newsletters/" + id(421), "DELETE"], ["/blog-posts/" + id(431), "PUT"]]) {
    assert.equal((await request(path, { method, cookie: owner.cookie, csrf: owner.csrf, json: { status: "replied" } })).status, 403);
  }
  assert.equal((await get("/contacts/" + id(411))).status, "unread");
  assert.equal((await get("/blog-posts/" + id(431))).supportCount, 3);
  const logout = await request("/logout", { method: "POST", cookie: owner.cookie, csrf: owner.csrf });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get("set-cookie"));
});

test("an empty readable business source stays distinct from missing sources", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const fixture = await createMongoFixture();
  const db = createDatabases(fixture.config);
  t.after(async () => { await db.close(); await fixture.client.close(); });
  const request = await http(t, createApp({ config: fixture.config, db, businessNow: now, log: () => {} }));
  const { cookie } = await login(request);
  const response = await request("/business-analytics?range=today", { cookie });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.contacts.status, "available");
  assert.equal(data.contacts.data.total, 0);
  assert.equal(data.users.status, "unavailable");
  assert.equal(data.engagement.status, "unavailable");
  assert.deepEqual(data.timeline, []);
});
