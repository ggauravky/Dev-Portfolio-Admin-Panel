const assert = require("node:assert/strict");
const { test } = require("node:test");

test("canonical minor units must agree with INR and the recorded major units", () => {
  const { money } = require("../payments/model");
  assert.deepEqual(money({ currency: "INR", amountPaise: 12345, amount: 123.45 }), { paise: "12345", currency: "INR", issue: null });
  for (const patch of [{ amountPaise: 12345.5 }, { amountPaise: Infinity }, { amountPaise: -1 }, { currency: "USD" }, { amount: null }, { amount: 123.46 }]) {
    assert.equal(money({ currency: "INR", amountPaise: 12345, amount: 123.45, ...patch }).paise, null);
  }
});

test("financial reporting uses IST month boundaries and distinguishes paid date", () => {
  const { financialRange, transactionQuery } = require("../payments/query");
  const now = new Date("2026-11-24T20:00:00Z");
  const month = financialRange({ range: "month" }, now);
  assert.equal(month.from.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(month.to.toISOString(), "2026-11-25T18:30:00.000Z");
  const q = transactionQuery({ dateField: "paidAt", search: "order_fixture", limit: "25" }, now);
  assert.equal(q.filter.razorpayOrderId, "order_fixture");
  assert.ok(q.filter.paidAt);
  assert.throws(() => transactionQuery({ search: { $ne: "" } }, now));
  assert.throws(() => transactionQuery({ pageSize: "101" }, now));
});

test("financial display keeps exact INR minor units", async () => {
  const { formatPaise } = await import("../../src/pages/admin/finance/money.js");
  assert.equal(formatPaise("123456789"), "₹12,34,567.89");
  assert.equal(formatPaise("9007199254740991"), "₹9,00,71,99,25,47,409.91");
  assert.equal(formatPaise(null), "Unavailable");
});

test("booking links reject conflicting identifiers and give recent paid records time to finalize", () => {
  const { transactionBooking, bookingTransaction } = require("../payments/relations");
  const { classifyTransaction, classifyBooking } = require("../payments/diagnostics");
  const { id, now, tx } = require("./financial-fixture");
  const payment = tx(1, { paidAt: new Date(+now() - 60_000), receiptNumber: null, bookingId: undefined });
  const booking = { _id: id(100), orderId: payment.razorpayOrderId, paymentId: payment.razorpayPaymentId, paymentProvider: "razorpay", amount: 100 };
  const link = transactionBooking(payment, [booking]);
  assert.equal(link.matchedBy, "gateway_identifier");
  assert.equal(bookingTransaction(booking, [payment]).matchedBy, "gateway_identifier");
  assert.equal(transactionBooking({ ...payment, bookingId: id(100) }, [{ ...booking, paymentId: "pay_conflict" }]).reason, "conflicting_booking_identifiers");
  assert.equal(transactionBooking({ ...payment, bookingId: "broken" }, [booking]).reason, "invalid_booking_reference");
  assert.equal(classifyBooking(booking, bookingTransaction(booking, [payment]))[0].code, "booking_amount_mismatch");
  assert.deepEqual(classifyBooking({ ...booking, paymentProvider: "cashfree" }, bookingTransaction({ ...booking, paymentProvider: "cashfree" }, [])), []);
  assert.equal(classifyTransaction(payment, { status: "missing" }, now()).find((item) => item.code === "booking_link_missing").severity, "informational");
  assert.equal(classifyTransaction(payment, { status: "missing" }, new Date(+now() + 360_000)).find((item) => item.code === "booking_link_missing").severity, "needs_review");
});

test("financial routes enforce proxy admission and reject absent, idle and revoked sessions", async (t) => {
  const { createApp } = require("../app");
  const { fixtureConfig, fixtureStore, http, login, proxySecret } = require("./auth-fixture");
  const store = fixtureStore();
  let clock = Date.now();
  const request = await http(t, createApp({ config: await fixtureConfig({ NODE_ENV: "production", ADMIN_PROXY_SECRET: proxySecret }),
    store, now: () => clock, db: { status: () => ({ chat: "not_configured" }), get: () => null }, log: () => {} }));
  const headers = { "X-Admin-Proxy-Key": proxySecret };
  const expired = await login(request, { headers });
  const revoked = await login(request, { headers });
  const paths = ["transactions", "bookings", "support-payments", "receipts", "webhook-events", "legacy-payments"];
  const scopes = [...paths, ...paths.map((path) => path + "/507f1f77bcf86cd799439011"), "financial-analytics", "financial-reconciliation"];
  assert.equal((await request("/financial-analytics", { cookie: expired.cookie })).status, 403);
  const report = await request("/financial-analytics", { cookie: expired.cookie, headers });
  assert.equal(report.status, 200);
  assert.equal((await report.json()).data.transactions.status, "unavailable");
  assert.equal((await request("/legacy-payments", { cookie: expired.cookie, headers })).status, 503);
  assert.equal((await request("/logout", { method: "POST", cookie: revoked.cookie, csrf: revoked.csrf, headers })).status, 200);
  clock += 31 * 60_000;
  for (const path of scopes) {
    for (const cookie of [undefined, expired.cookie, revoked.cookie]) {
      const response = await request("/" + path, { cookie, headers });
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});
