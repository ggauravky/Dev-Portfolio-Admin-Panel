const { listQuery } = require("../repositories/reads");
const { invalid } = require("../utils/http");
const { optional, page, maxTimeMS } = require("./access");
const { idString, money, date, nonEmpty, presentId, project, claimMs, recentMs, txStatus } = require("./model");
const { financialRange, rangeFilter } = require("./query");
const { txLinks, bookingLinks, related } = require("./relations");

const limit = 200;
const types = {
  amount_invalid: "Canonical monetary fields are missing, invalid or inconsistent.",
  paid_at_missing: "Paid state has no valid recorded paid timestamp.",
  paid_gateway_missing: "Paid state is missing an order or payment identifier.",
  required_field_missing: "Current transaction schema fields are missing or invalid.",
  booking_link_missing: "A paid service transaction has no matched booking.",
  booking_link_conflict: "The booking relationship is missing its explicit target or conflicts with other identifiers.",
  booking_amount_mismatch: "Recorded booking amount differs from canonical transaction paise.",
  booking_transaction_missing: "A Razorpay booking has no matched service transaction.",
  booking_transaction_conflict: "Recorded booking references disagree with the matched transaction.",
  receipt_missing: "Paid transaction has no receipt identity.",
  receipt_generated_at_missing: "A receipt identity is recorded without a generation timestamp.",
  email_metadata_conflict: "An email timestamp conflicts with its recorded status.",
  email_claim_stale: "A delivery claim exceeds the five-minute workflow claim window.",
  webhook_claim_stale: "Webhook processing exceeds the five-minute workflow claim window.",
  webhook_transaction_missing: "Recorded webhook transaction reference has no matching record.",
  webhook_processed_at_missing: "Processed or ignored webhook has no valid processed timestamp.",
  duplicate_identifier: "Multiple records have the same exact identifier in the scan scope or a bounded lookup.",
};

const requiredFields = ["internalReference", "serviceSlug", "serviceName", "customerName", "email", "phone"];
const transactionProjection = project("transactions", "detail");
const kFields = { transactions: ["internalReference", "razorpayOrderId", "razorpayPaymentId", "receiptNumber"], bookings: ["orderId", "paymentId"], webhooks: ["eventId"] };

function issue(row, kind, code, severity, evidence = null) {
  return {
    source: kind, id: row._id, reference: row.internalReference || row.eventId || idString(row._id),
    observedAt: date(row.createdAt), code, severity, description: types[code], evidence,
  };
}

function classifyTransaction(tx, link, now) {
  const found = [];
  const add = (code, severity = "needs_review", evidence = null) => found.push(issue(tx, "transactions", code, severity, evidence));
  const value = money(tx);
  if (value.issue) add("amount_invalid", "potential_inconsistency", value.issue);
  const missing = requiredFields.filter((key) => !nonEmpty(tx[key]));
  if (!["service", "support"].includes(tx.flowType)) missing.push("flowType");
  if (!txStatus.includes(tx.status)) missing.push("status");
  if (!idString(tx.userId)) missing.push("userId");
  if (tx.flowType === "service" && !date(tx.preferredDate)) missing.push("preferredDate");
  if (tx.flowType === "service" && !nonEmpty(tx.preferredTime)) missing.push("preferredTime");
  if (missing.length) add("required_field_missing", "needs_review", missing.join(", "));
  const relevantTime = date(tx.paidAt) || date(tx.updatedAt) || date(tx.createdAt);
  const recent = !relevantTime || +now - +relevantTime < recentMs;
  if (tx.status === "paid") {
    if (!date(tx.paidAt)) add("paid_at_missing");
    if (!presentId(tx.razorpayOrderId) || !presentId(tx.razorpayPaymentId)) add("paid_gateway_missing");
    if (tx.flowType === "service" && link?.status === "missing") add("booking_link_missing", recent ? "informational" : "needs_review", recent ? "Within the Admin finalization grace window." : null);
    if (!nonEmpty(tx.receiptNumber)) add("receipt_missing", recent ? "informational" : "needs_review", recent ? "Within the Admin finalization grace window." : null);
  }
  if (nonEmpty(tx.receiptNumber) && !date(tx.receiptGeneratedAt)) add("receipt_generated_at_missing");
  if (link?.status === "inconsistent") add("booking_link_conflict", link.reason === "referenced_booking_missing" && recent ? "needs_review" : "potential_inconsistency", link.reason);
  if (link?.status === "linked" && value.paise !== null && Number.isFinite(link.record.amount) && link.record.amount !== Number(value.paise) / 100) {
    add("booking_amount_mismatch", "confirmed_structural_mismatch");
  }
  for (const prefix of ["receiptEmail", "adminEmail"]) {
    const status = tx[prefix + "Status"];
    const sent = date(tx[prefix + "SentAt"]);
    if ((status === "sent") !== Boolean(sent) && (status === "sent" || sent)) add("email_metadata_conflict", "potential_inconsistency", prefix);
    const claimed = date(tx[prefix + "ClaimedAt"]);
    if (status === "processing" && claimed && +now - +claimed > claimMs) add("email_claim_stale", "needs_review", prefix);
  }
  return found;
}

function classifyBooking(booking, link) {
  if (link?.status === "inconsistent") return [issue(booking, "bookings", "booking_transaction_conflict", "potential_inconsistency", link.reason)];
  if (link?.status === "missing" && booking.paymentProvider === "razorpay") return [issue(booking, "bookings", "booking_transaction_missing", "needs_review")];
  if (link?.status === "linked" && link.record.amountPaise !== null && Number.isFinite(booking.amount) && booking.amount !== Number(link.record.amountPaise) / 100) {
    return [issue(booking, "bookings", "booking_amount_mismatch", "confirmed_structural_mismatch")];
  }
  return [];
}

function classifyWebhook(event, valid, now) {
  const issues = [];
  if (valid && event.transactionId != null && !valid.has(idString(event.transactionId))) issues.push(issue(event, "webhooks", "webhook_transaction_missing", "potential_inconsistency"));
  if (["processed", "ignored"].includes(event.status) && !date(event.processedAt)) issues.push(issue(event, "webhooks", "webhook_processed_at_missing", "needs_review"));
  const updated = date(event.updatedAt);
  if (event.status === "processing" && updated && +now - +updated >= claimMs) issues.push(issue(event, "webhooks", "webhook_claim_stale", "needs_review"));
  return issues;
}

async function duplicates(access, source, rows) {
  const fields = kFields[source];
  if (!rows.length) return [];
  // Check the bounded candidate identities across their collection, not just adjacent rows.
  const facets = Object.fromEntries(fields.map((field) => {
    const values = [...new Set(rows.map((row) => row[field]).filter(presentId))];
    return [field, [
      { $match: { [field]: { $in: values } } },
      { $group: { _id: "$" + field, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: limit },
    ]];
  }));
  const filters = fields.map((field) => ({ [field]: { $in: [...new Set(rows.map((row) => row[field]).filter(presentId))] } }));
  const [counts] = await access.aggregate(source, [{ $match: { $or: filters } }, { $facet: facets }]);
  return rows.flatMap((row) => fields.flatMap((key) => counts?.[key]?.some((entry) => entry._id === row[key]) ?
    [issue(row, source, "duplicate_identifier", "potential_inconsistency", key)] : []));
}

function createDiagnostics(access, now) {
  return async function diagnostics(query) {
    const { source = "transactions", issue: code, range, from, to, severity, ...params } = query;
    if (typeof source !== "string" || !Object.hasOwn(kFields, source) || code !== undefined && (typeof code !== "string" || !Object.hasOwn(types, code)) ||
      severity !== undefined && !["informational", "needs_review", "potential_inconsistency", "confirmed_structural_mismatch"].includes(severity)) throw invalid("Invalid diagnostic filter");
    const q = listQuery(params, { sort: "createdAt" }, {});
    const at = now();
    const dates = financialRange({ range, from, to }, at);
    const filter = { createdAt: rangeFilter(dates), ...(source === "bookings" ? {} : { provider: "razorpay" }) };
    const rows = await access.run(source, (c) => c.find(filter, { projection: source === "transactions" ? transactionProjection : project(source), maxTimeMS })
      .sort(q.sort).limit(limit + 1).toArray());
    const truncated = rows.length > limit;
    const candidates = rows.slice(0, limit);
    const [linkResult, duplicateResult] = await Promise.all([
      optional(async () => {
        if (source === "transactions") return txLinks(access, candidates);
        if (source === "bookings") return bookingLinks(access, candidates);
        const ids = candidates.map((row) => row.transactionId).filter(idString);
        const matches = ids.length ? await related(access, "transactions", [{ _id: { $in: ids } }], { provider: "razorpay" }) : [];
        return new Set(matches.map((row) => idString(row._id)));
      }),
      optional(() => duplicates(access, source, candidates)),
    ]);
    const links = linkResult.data;
    const findings = candidates.flatMap((row, index) => source === "transactions" ? classifyTransaction(row, links?.[index], at) :
      source === "bookings" ? classifyBooking(row, links?.[index]) : classifyWebhook(row, links, at));
    findings.push(...(duplicateResult.data || []));
    const filtered = findings.filter((row) => (!code || row.code === code) && (!severity || row.severity === severity));
    return { ...page(q, filtered.slice(q.skip, q.skip + q.pageSize), filtered.length), dates, source, scanned: candidates.length,
      candidateLimit: limit, truncated, issueTypes: Object.keys(types), observedAt: at,
      checks: { links: { status: linkResult.status, message: linkResult.message }, duplicates: { status: duplicateResult.status, message: duplicateResult.message } } };
  };
}

module.exports = { createDiagnostics, classifyTransaction, classifyBooking, classifyWebhook };
