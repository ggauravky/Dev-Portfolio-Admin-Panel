const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createApp } = require("../app");
const { createDatabases } = require("../config/database");
const { http, login } = require("./auth-fixture");
const { financialFixture, id, now, tx } = require("./financial-fixture");
const { createMongoFixture } = require("./mongo-fixture");

test("isolated MongoDB financial reports, links, diagnostics and privacy", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const fixture = await financialFixture();
  t.after(() => fixture.client.close());
  const db = createDatabases(fixture.config);
  t.after(() => db.close());
  const request = await http(t, createApp({ config: fixture.config, db, financialNow: now, log: () => {} }));
  const auth = await login(request);
  assert.equal(auth.response.status, 200);
  const get = async (path, expected = 200) => {
    const response = await request(path, { cookie: auth.cookie });
    const body = await response.json();
    assert.equal(response.status, expected, path + " " + JSON.stringify(body).slice(0, 180));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(JSON.stringify(body), /hidden-fixture|hidden-email-provider|hidden gateway diagnostics|webhookSignature|"metadata"|"ipAddress"/);
    return body.data ?? body;
  };
  const rollup = await get("/financial-analytics?range=today");
  assert.equal(rollup.transactions.status, "available", JSON.stringify(rollup.transactions));
  const { attempts, paid } = rollup.transactions.data;
  assert.equal(attempts.total, 8);
  assert.equal(attempts.pendingService, 1);
  assert.equal(attempts.pendingPaise, "4999");
  assert.equal(attempts.authorized, 1);
  assert.equal(attempts.refunded, 1);
  assert.equal(paid.count, 5);
  assert.equal(paid.excluded, 2);
  assert.equal(paid.totalPaise, "14447");
  assert.equal(paid.servicePaise, "12445");
  assert.equal(paid.supportPaise, "2002");
  assert.equal(rollup.bookings.data.confirmedPaid, 2);
  assert.equal(rollup.webhooks.data.total, 4);
  assert.equal(rollup.transactions.data.paymentMode, "unverified");
  assert.equal(rollup.transactions.data.refundAmountPaise, null);
  assert.equal(rollup.transactions.data.netRevenuePaise, null);
  assert.equal(rollup.transactions.data.dailyPaid[0].key, "2026-11-25");
  assert.equal((await get("/financial-analytics?from=2026-11-24&to=2026-11-24")).transactions.data.paid.totalPaise, "0");

  const page = await get("/transactions?pageSize=2&page=2");
  assert.equal(page.items.length, 2);
  assert.doesNotMatch(JSON.stringify(page), /buyer@example\.test|9000000000|projectBrief|receiptEmailMessageId/);
  assert.equal((await get("/transactions?dateField=paidAt&search=order_fixture1")).items[0]._id, id(1).toHexString());
  assert.ok((await get("/transactions?flowType=support&search=buyer%40example.test")).items.every((row) => row.flowType === "support"));
  const detail = await get("/transactions/" + id(1));
  assert.equal(detail.email, "buyer@example.test");
  assert.equal(detail.booking.data.record._id, id(101).toHexString());
  assert.equal(detail.booking.data.matchedBy, "booking_id");
  assert.equal(detail.webhooks.data.items.length, 2);
  assert.equal(detail.receipt.customer.status, "failed");
  assert.equal(detail.receipt.customer.attempts, 3);
  assert.equal(detail.receipt.admin.status, "sent");
  assert.equal(detail.receipt.availability, "identity_recorded");
  assert.equal((await get("/transactions/" + id(4))).booking.data.status, "missing");
  assert.equal((await get("/support-payments/" + id(2))).message, "<em>Fixture message</em>");
  await get("/support-payments/" + id(1), 404);
  assert.equal((await get("/bookings/" + id(101))).transaction.data.record._id, id(1).toHexString());
  assert.equal((await get("/bookings/" + id(102))).transaction.data.status, "legacy");
  assert.equal((await get("/bookings?view=review")).items[0]._id, id(103).toHexString());
  const future = await get("/bookings?view=upcoming");
  assert.equal(future.items[0].preferredTime, "11:30");
  const receipts = await get("/receipts?issue=receipt-failed");
  assert.equal(receipts.total, 1);
  assert.equal(receipts.items[0].receipt.customer.attempts, 3);
  assert.equal((await get("/receipts?issue=admin-failed")).items[0].receipt.admin.status, "failed");
  assert.equal((await get("/receipts?issue=missing-receipt")).items[0].receipt.availability, "not_available");
  assert.equal((await get("/receipts?issue=stale-email")).items[0].receipt.customer.staleClaim, true);
  const hook = await get("/webhook-events/" + id(202));
  assert.equal(hook.transaction.data.status, "linked");
  assert.equal(hook.transaction.data.paymentStatus, "paid");
  assert.equal(hook.transaction.data.internalReference, detail.internalReference);
  assert.match(hook.failure, /withheld/);
  assert.equal((await get("/webhook-events?range=all&transactionId=" + id(1) + "&pageSize=1&page=2")).total, 2);
  await get("/webhook-events?range=all", 400);
  assert.equal((await get("/webhook-events?status=ignored")).total, 1);
  assert.equal((await get("/legacy-payments")).items[0].paymentProvider, "cashfree");
  assert.ok((await get("/financial-reconciliation?issue=booking_link_missing")).items.some((row) => row.id === id(6).toHexString()));
  assert.ok((await get("/financial-reconciliation?issue=duplicate_identifier")).total >= 2);
  assert.ok((await get("/financial-reconciliation?source=webhooks")).items.some((row) => row.code === "webhook_transaction_missing"));
  await get("/transactions/not-an-id", 400);
  await get("/transactions?pageSize=101", 400);
  await get("/transactions?search%5B%24ne%5D=x", 400);
  await get("/transactions?from=2026-11-25&to=2026-11-23", 400);
  const stats = await get("/stats");
  assert.equal(stats.financialSummary.transactions.data.paid.totalPaise, "14447");
  const collections = ["paymenttransactions", "bookings", "paymentwebhookevents", "supportpayments"];
  const sharedRecords = () => Promise.all(collections.map((name) => fixture.primary.collection(name).find().sort({ _id: 1 }).toArray()));
  const before = await sharedRecords();
  for (const [method, path] of [["DELETE", "/bookings/" + id(101)], ["DELETE", "/transactions/" + id(1)],
    ["PATCH", "/transactions/" + id(1)], ["POST", "/transactions/" + id(1) + "/mark-paid"],
    ["POST", "/transactions/" + id(1) + "/refund"], ["PUT", "/receipts/" + id(1)],
    ["POST", "/receipts/" + id(1) + "/resend"], ["POST", "/webhook-events/" + id(201) + "/replay"]]) {
    assert.equal((await request(path, { method, cookie: auth.cookie, csrf: auth.csrf, json: { amountPaise: 11, razorpayOrderId: "order_changed" } })).status, 403);
  }
  assert.deepEqual(await sharedRecords(), before);
  await fixture.primary.collection("paymenttransactions").insertMany(Array.from({ length: 200 }, (_, i) => tx(1_000 + i, {
    flowType: "support", status: "pending", paidAt: null, amountPaise: null, receiptNumber: null,
  })));
  const review = await get("/financial-reconciliation?range=today&issue=amount_invalid&pageSize=5");
  assert.equal(review.scanned, 200);
  assert.equal(review.truncated, true);
  assert.equal(review.items.length, 5);
});

test("isolated MongoDB distinguishes empty financial collections from unavailable sources", {
  skip: process.env.RUN_ADMIN_MONGO_TEST !== "1", timeout: 30_000,
}, async (t) => {
  const fixture = await createMongoFixture();
  t.after(() => fixture.client.close());
  await fixture.primary.createCollection("paymenttransactions");
  await fixture.primary.createCollection("supportpayments");
  const db = createDatabases(fixture.config);
  t.after(() => db.close());
  const request = await http(t, createApp({ config: fixture.config, db, financialNow: now, log: () => {} }));
  const { cookie } = await login(request);
  const report = await request("/financial-analytics?range=today", { cookie });
  assert.equal(report.status, 200);
  const { data } = await report.json();
  assert.equal(data.transactions.data.paid.totalPaise, "0");
  assert.equal(data.bookings.status, "unavailable");
  assert.equal(data.webhooks.status, "unavailable");
  const legacy = await request("/legacy-payments", { cookie });
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).data.total, 0);
});
