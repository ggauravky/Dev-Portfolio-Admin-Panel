const contract = require("../contracts/portfolio-schema.json").collections;

const txStatus = contract.paymenttransactions.fields.status.enum;
const bookingStatus = contract.bookings.fields.paymentStatus.enum;
const emailStatus = contract.paymenttransactions.fields.receiptEmailStatus.enum;
const webhookStatus = contract.paymentwebhookevents.fields.status.enum;
const failureCategories = ["authentication", "network", "provider", "order_creation"];
const gatewayCodes = ["PAYMENT_GATEWAY_AUTH_FAILED", "PAYMENT_GATEWAY_REQUEST_FAILED", "ORDER_CREATION_FAILED",
  "BAD_REQUEST_ERROR", "GATEWAY_ERROR", "SERVER_ERROR", "AUTHENTICATION_ERROR", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];
const webhookTypes = ["payment.captured", "payment.failed", "order.paid"];
const claimMs = 5 * 60 * 1000;
const recentMs = claimMs;

const projections = {
  transactions: {
    list: "_id internalReference customerName contributorName flowType provider serviceName serviceSlug amount amountPaise currency status receiptNumber receiptEmailStatus adminEmailStatus failureCategory failureCode providerStatus createdAt paidAt",
    extra: "userId email phone preferredDate preferredTime projectBrief message razorpayOrderId razorpayPaymentId bookingId updatedAt failedAt verificationAcceptedAt webhookReceivedAt receiptGeneratedAt receiptEmailAttemptCount receiptEmailLastAttemptAt receiptEmailSentAt receiptEmailClaimedAt adminEmailAttemptCount adminEmailLastAttemptAt adminEmailSentAt adminEmailClaimedAt providerErrorCode failureReason",
    link: "_id internalReference flowType provider bookingId razorpayOrderId razorpayPaymentId amount amountPaise currency status paidAt receiptNumber receiptEmailStatus adminEmailStatus receiptGeneratedAt",
  },
  bookings: {
    list: "_id name service serviceSlug preferredDate preferredTime amount paymentProvider paymentStatus createdAt date paidAt reconciliationStatus orderId paymentId",
    extra: "userId email phone projectBrief updatedAt verificationAcceptedAt webhookReceivedAt receiptEmailSentAt receiptEmailLastAttemptAt adminEmailSentAt adminEmailLastAttemptAt reconciliationAttempts lastReconciliationAt",
    link: "_id service paymentProvider paymentStatus amount orderId paymentId paidAt createdAt",
  },
  webhooks: {
    list: "_id eventId provider eventType status attempts transactionId processedAt createdAt updatedAt eventKey eventName receivedAt",
    extra: "error",
  },
  legacy: {
    list: "_id contributorName amount paymentProvider paymentStatus orderId paymentId createdAt paidAt",
    extra: "email phone message",
  },
};

function project(kind, view = "list") {
  const { list, extra, link } = projections[kind];
  const fields = view === "detail" ? list + " " + extra : view === "link" ? link || list : list;
  return Object.fromEntries(fields.split(" ").filter(Boolean).map((key) => [key, 1]));
}

const known = (value, values) => values.includes(value) ? value : value ? "unclassified" : null;
const date = (value) => value instanceof Date && Number.isFinite(+value) ? value : null;
const nonEmpty = (value) => typeof value === "string" && !!value.trim();
const idString = (id) => id && typeof id.toHexString === "function" ? id.toHexString() : null;
const presentId = (value) => typeof value === "string" && value.length > 0 && value.length <= 120;
function money({ currency, amountPaise, amount }) {
  let issue = null;
  if (currency !== "INR") issue = "currency_unverified";
  else if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) issue = "invalid_paise";
  else if (!Number.isFinite(amount) || amount !== amountPaise / 100) issue = "amount_mismatch";
  return { paise: issue ? null : String(amountPaise), currency: currency === "INR" ? currency : null, issue };
}

const validPaise = { $and: [
  { $eq: ["$currency", "INR"] },
  { $in: [{ $type: "$amountPaise" }, ["int", "long", "double"]] },
  { $in: [{ $type: "$amount" }, ["int", "long", "double"]] },
  { $gte: ["$amountPaise", 100] }, { $lte: ["$amountPaise", Number.MAX_SAFE_INTEGER] },
  { $eq: ["$amountPaise", { $convert: { input: "$amountPaise", to: "long", onError: null, onNull: null } }] },
  { $eq: ["$amount", { $divide: [{ $convert: { input: "$amountPaise", to: "double", onError: null, onNull: null } }, 100] }] },
] };
const decimalPaise = { $toDecimal: { $convert: { input: "$amountPaise", to: "long", onError: null, onNull: null } } };

function delivery(record, prefix, now) {
  const status = known(record[prefix + "Status"], emailStatus);
  const claimedAt = date(record[prefix + "ClaimedAt"]);
  return { status,
    attempts: Number.isSafeInteger(record[prefix + "AttemptCount"]) && record[prefix + "AttemptCount"] >= 0 ? record[prefix + "AttemptCount"] : null,
    lastAttemptAt: date(record[prefix + "LastAttemptAt"]), sentAt: date(record[prefix + "SentAt"]),
    claimedAt, staleClaim: status === "processing" && claimedAt ? +now - +claimedAt > claimMs : null,
  };
}

const knownWebhookErrors = {
  "Webhook transaction was not found": "No matching transaction was found.",
  "Captured payment was missing from webhook payload": "Captured payment data was missing.",
  "Webhook payment is not captured": "The recorded webhook payment was not captured.",
};
function webhook(input, details) {
  // Older Portfolio webhook records: map their fields onto the current shape without inventing a status.
  const legacy = input.provider === undefined && typeof input.eventKey === "string";
  const record = legacy ? { ...input, eventId: input.eventKey, eventType: input.eventName, createdAt: input.receivedAt } : input;
  const { eventKey, eventName, receivedAt, ...fields } = pick(record, project("webhooks"));
  const item = { ...fields, status: known(record.status, webhookStatus), ...(legacy ? { schema: "legacy" } : {}) };
  item.eventType = webhookTypes.includes(record.eventType) ? record.eventType : "other_recorded_type";
  if (details) item.failure = Object.hasOwn(knownWebhookErrors, record.error) ? knownWebhookErrors[record.error] :
    record.status === "failed" || nonEmpty(record.error) ? "Processing error recorded. Raw diagnostic text is withheld." : null;
  return item;
}

function pick(record, projection) {
  return Object.fromEntries(Object.keys(projection).filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
}

function transaction(record, now, details = false) {
  const { amount, amountPaise, currency, failureCode, failureCategory, providerStatus, ...item } = pick(record, project("transactions"));
  const value = money(record);
  const status = known(item.status, txStatus);
  const failure = {
    code: known(record.failureCode, gatewayCodes),
    category: known(record.failureCategory, failureCategories),
    providerCode: details ? known(record.providerErrorCode, gatewayCodes) : null,
    providerStatus: Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599 ? providerStatus : null,
    description: status === "failed" || nonEmpty(record.failureReason) ?
      (failureCategories.includes(record.failureCategory) ? {
        authentication: "Gateway authentication failed during order creation.",
        network: "A gateway network failure was recorded.",
        provider: "The gateway reported an order-creation failure.",
        order_creation: "Order creation failed.",
      }[record.failureCategory] : "A failure was recorded. Raw diagnostic text is withheld.") : null,
  };
  const result = { ...item, status, failure, amountPaise: value.paise, currency: value.currency, amountIssue: value.issue, paymentMode: "unverified" };
  if (!details) return result;
  const extra = pick(record, project("transactions", "detail"));
  for (const key of ["userId", "email", "phone", "preferredDate", "preferredTime", "projectBrief", "message", "razorpayOrderId", "razorpayPaymentId",
    "bookingId", "updatedAt", "failedAt", "verificationAcceptedAt", "webhookReceivedAt", "receiptGeneratedAt"]) {
    if (Object.hasOwn(extra, key)) result[key] = extra[key];
  }
  result.receipt = { number: nonEmpty(record.receiptNumber) ? record.receiptNumber : null, generatedAt: date(record.receiptGeneratedAt),
    availability: status === "paid" && nonEmpty(record.receiptNumber) ? "identity_recorded" : "not_available",
    customer: delivery(record, "receiptEmail", now), admin: delivery(record, "adminEmail", now) };
  return result;
}

module.exports = { txStatus, bookingStatus, emailStatus, webhookStatus, failureCategories, webhookTypes, claimMs, recentMs, project, pick, money,
  validPaise, decimalPaise, date, nonEmpty, idString, presentId, webhook, transaction };
