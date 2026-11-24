const { HttpError } = require("../utils/http");
const { maxTimeMS } = require("./access");
const { project, pick, idString, presentId, money } = require("./model");

const equalId = (left, right) => idString(left) !== null && idString(left) === idString(right);
const exact = (left, right) => presentId(left) && left === right;
const contradict = (left, right) => presentId(left) && presentId(right) && left !== right;
const result = (status, reason, record = null, matchedBy = null) => ({ status, reason, record, matchedBy });
const selectors = (rows, pairs) => pairs.flatMap(([from, to, type]) => {
  const values = rows.map((item) => item[from]).filter(type === "id" ? idString : presentId);
  return values.length ? [{ [to]: { $in: values } }] : [];
});

async function related(access, kind, query, fixed = {}) {
  if (!query.length) return [];
  const rows = await access.run(kind, (collection) =>
    collection.find({ ...fixed, $or: query }, { projection: project(kind, "link"), maxTimeMS }).limit(601).toArray());
  if (rows.length > 600) throw new HttpError(503, "FINANCIAL_RELATION_LIMIT", "Too many records share the selected identifiers to verify a link.");
  return rows;
}

function transactionBooking(tx, bookings) {
  if (tx.flowType !== "service") return result("not_applicable", "support_flow");
  const candidates = bookings.filter((b) => equalId(tx.bookingId, b._id) || exact(tx.razorpayOrderId, b.orderId) || exact(tx.razorpayPaymentId, b.paymentId));
  if (tx.bookingId != null && !idString(tx.bookingId)) return result("inconsistent", "invalid_booking_reference");
  if (candidates.length > 1) return result("inconsistent", "multiple_booking_matches");
  const [booking] = candidates;
  const direct = booking && equalId(tx.bookingId, booking._id);
  if (tx.bookingId != null && !direct) return result("inconsistent", "referenced_booking_missing");
  if (!booking) return result("missing", "no_booking_match");
  if ((booking.paymentProvider && booking.paymentProvider !== "razorpay") ||
      contradict(tx.razorpayOrderId, booking.orderId) || contradict(tx.razorpayPaymentId, booking.paymentId)) {
    return result("inconsistent", "conflicting_booking_identifiers");
  }
  return result("linked", null, pick(booking, project("bookings", "link")), direct ? "booking_id" : "gateway_identifier");
}

function bookingTransaction(booking, transactions) {
  const candidates = transactions.filter((tx) => equalId(tx.bookingId, booking._id) || exact(tx.razorpayOrderId, booking.orderId) || exact(tx.razorpayPaymentId, booking.paymentId));
  if (!candidates.length && booking.paymentProvider && booking.paymentProvider !== "razorpay") return result("legacy", "non_razorpay_booking");
  if (candidates.length > 1) return result("inconsistent", "multiple_transaction_matches");
  const [tx] = candidates;
  if (!tx) return result("missing", "no_transaction_match");
  if (tx.bookingId != null && !equalId(tx.bookingId, booking._id)) return result("inconsistent", "conflicting_transaction_backlink");
  const checked = transactionBooking(tx, [booking]);
  if (checked.status !== "linked") return result("inconsistent", checked.reason);
  const value = money(tx);
  return result("linked", null, {
    _id: tx._id, internalReference: tx.internalReference, status: tx.status, paidAt: tx.paidAt,
    amountPaise: value.paise, currency: value.currency, amountIssue: value.issue, receiptNumber: tx.receiptNumber,
    receiptEmailStatus: tx.receiptEmailStatus, adminEmailStatus: tx.adminEmailStatus, receiptGeneratedAt: tx.receiptGeneratedAt,
  }, checked.matchedBy);
}

async function txLinks(access, rows) {
  const bookings = await related(access, "bookings", selectors(rows.filter((r) => r.flowType === "service"), [
    ["bookingId", "_id", "id"], ["razorpayOrderId", "orderId"], ["razorpayPaymentId", "paymentId"],
  ]));
  return rows.map((row) => transactionBooking(row, bookings));
}

async function bookingLinks(access, rows) {
  const transactions = await related(access, "transactions", selectors(rows, [
    ["_id", "bookingId", "id"], ["orderId", "razorpayOrderId"], ["paymentId", "razorpayPaymentId"],
  ]), { provider: "razorpay", flowType: "service" });
  return rows.map((row) => bookingTransaction(row, transactions));
}

module.exports = { txLinks, bookingLinks, transactionBooking, bookingTransaction, related };
