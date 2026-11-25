const { createMongoFixture } = require("./mongo-fixture");
const { mongo: { ObjectId } } = require("mongoose");

const id = (value) => new ObjectId(value.toString(16).padStart(24, "0"));
const now = () => new Date("2026-11-25T12:00:00Z");
const at = (hour = "06:00:00") => new Date("2026-11-25T" + hour + "Z");
const tx = (n, patch) => ({
  _id: id(n), userId: id(90), flowType: "service", provider: "razorpay", serviceSlug: "frontend-development", serviceName: "Fixture service",
  amount: 123.45, amountPaise: 12345, currency: "INR", status: "paid", customerName: "Fixture customer",
  email: "buyer@example.test", phone: "9000000000", preferredDate: new Date("2026-11-26T00:00:00Z"), preferredTime: "11:30",
  internalReference: "GKY-20261125-" + String(n).padStart(10, "0"), razorpayOrderId: "order_fixture" + n, razorpayPaymentId: "pay_fixture" + n,
  receiptNumber: "GKY-2026-" + String(n).padStart(12, "0"), receiptGeneratedAt: at(), paidAt: at(), createdAt: at(), updatedAt: at(),
  receiptEmailStatus: "sent", receiptEmailSentAt: at(), adminEmailStatus: "not_sent", ipAddress: "hidden-fixture-ip",
  webhookSignature: "hidden-fixture-sig", metadata: { paymentMode: "test" }, ...patch,
});
const rows = [
  tx(1, { createdAt: new Date("2026-11-18T18:29:00Z"), bookingId: id(101), receiptEmailStatus: "failed", receiptEmailSentAt: null,
    receiptEmailAttemptCount: 3, receiptEmailLastAttemptAt: at("06:10:00"), receiptEmailMessageId: "hidden-email-provider",
    adminEmailStatus: "sent", adminEmailSentAt: at(), adminEmailAttemptCount: 1 }),
  tx(2, { flowType: "support", amount: 20.02, amountPaise: 2002, contributorName: "Fixture supporter",
    message: "<em>Fixture message</em>", adminEmailStatus: "failed", adminEmailAttemptCount: 2 }),
  tx(3, { flowType: "support", amount: 300, amountPaise: 100, receiptEmailStatus: "sent", receiptEmailSentAt: null }),
  tx(4, { status: "pending", amount: 49.99, amountPaise: 4999, paidAt: null, receiptNumber: "", receiptGeneratedAt: null }),
  tx(5, { status: "refunded" }),
  tx(6, { amount: 1, amountPaise: 100, receiptNumber: "", receiptGeneratedAt: null, receiptEmailStatus: "processing",
    receiptEmailClaimedAt: at("10:00:00"), receiptEmailSentAt: null }),
  tx(7, { currency: "USD", flowType: "support" }),
  tx(8, { status: "failed", paidAt: null, failureCategory: "authentication", failureCode: "PAYMENT_GATEWAY_AUTH_FAILED",
    providerStatus: 401, failureReason: "hidden gateway diagnostics with fixture data", failedAt: at(), internalReference: "GKY-20261125-0000000005" }),
  tx(9, { status: "authorized", paidAt: null, orderId: "order_never_booked" }),
];
const bookings = [
  { _id: id(101), name: "Fixture customer", service: "Fixture service", amount: 123.45, paymentStatus: "paid", paymentProvider: "razorpay",
    email: "buyer@example.test", paidAt: at(), preferredDate: new Date("2026-11-26T00:00:00Z"), preferredTime: "11:30",
    orderId: "order_fixture1", paymentId: "pay_fixture1", createdAt: at(), projectBrief: "Read-only fixture brief" },
  { _id: id(102), name: "Historical fixture", service: "Legacy service", amount: 999, paymentStatus: "paid", paymentProvider: "cashfree", paidAt: at(), createdAt: at() },
  { _id: id(103), name: "Orphan fixture", service: "Fixture service", amount: 20, paymentStatus: "paid", paymentProvider: "razorpay",
    paidAt: at(), orderId: "order_missing_fixture", createdAt: at() },
];
const event = (n, status, transactionId, extra) => ({ _id: id(n), eventId: "evt_fixture" + n, provider: "razorpay", eventType: "payment.captured", status,
  transactionId, attempts: 1, createdAt: at(), updatedAt: at(), ...extra });
const events = [
  event(201, "processed", id(1), { processedAt: at("06:00:03") }),
  event(202, "failed", id(1), { eventType: "order.paid", error: "hidden gateway diagnostics with fixture data", attempts: 3 }),
  event(203, "ignored", null, { eventType: "partition.example", processedAt: at("06:00:06") }),
  event(204, "processing", id(998), {}),
  // Shape written by an older Portfolio release.
  { _id: id(205), eventKey: "payment.captured:pay_fixture205", eventName: "payment.captured", orderId: "order_fixture205", paymentId: "pay_fixture205", receivedAt: at() },
];
async function financialFixture(extra) {
  const fixture = await createMongoFixture(extra);
  try {
    for (const [name, entries] of Object.entries({ paymenttransactions: rows, bookings, paymentwebhookevents: events,
      supportpayments: [{ _id: id(301), contributorName: "Legacy fixture contributor", paymentProvider: "cashfree", paymentStatus: "paid", amount: 9999, createdAt: at() }],
    })) await fixture.primary.collection(name).insertMany(entries);
    return fixture;
  } catch (error) {
    await fixture.client.close();
    throw error;
  }
}
module.exports = { financialFixture, id, now, tx };
