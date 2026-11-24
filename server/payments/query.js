const { listQuery, identifier } = require("../repositories/reads");
const { reportingRange, only } = require("../chat/query");
const { invalid } = require("../utils/http");
const { txStatus, bookingStatus, emailStatus, webhookStatus, failureCategories, webhookTypes, claimMs } = require("./model");

const txSpec = { search: "customerName contributorName serviceName", sort: "createdAt paidAt amountPaise status updatedAt", filters: {
  status: txStatus, flowType: ["service", "support"], receiptEmailStatus: emailStatus, adminEmailStatus: emailStatus,
  failureCategory: [...failureCategories, "unclassified"],
} };
const bookingSpec = { search: "name service", sort: "createdAt date paidAt preferredDate amount paymentStatus", filters: {
  paymentStatus: bookingStatus, paymentProvider: ["razorpay", "cashfree"],
} };
const webhookSpec = { sort: "createdAt processedAt attempts updatedAt status", filters: { status: webhookStatus, eventType: [...webhookTypes, "other"] } };
const legacySpec = { search: "contributorName", sort: "createdAt paidAt amount paymentStatus", filters: bookingSpec.filters };
const ageAt = (now, ms) => new Date(+now - ms);
const financialRange = (query, now) => reportingRange(query, now, "30d", { allowMonth: true, allowHistory: true });
const rangeFilter = (range) => ({ $gte: range.from, $lt: range.to });
const objectId = (value) => identifier(value, "primary");
const safeText = /^[A-Za-z0-9:_-]{1,160}$/;
const missingReceipt = { receiptNumber: { $in: [null, ""] } };

function exact(search, type) {
  if (/^order_/.test(search)) return type === "transactions" ? "razorpayOrderId" : "orderId";
  if (/^pay_/.test(search)) return type === "transactions" ? "razorpayPaymentId" : "paymentId";
  if (type === "transactions" && /^GKY-\d{4}-[A-Z0-9]{12}$/i.test(search)) return "receiptNumber";
  if (type === "transactions" && /^GKY-/i.test(search)) return "internalReference";
  return null;
}

function parse(query, specification, finalFixed, now, type) {
  const { range, from, to, service, dateField, view, issue, transactionId, ...rest } = query;
  if (Object.entries({ range, from, to, service, dateField, view, issue, transactionId }).some(([, value]) =>
    value !== undefined && typeof value !== "string")) throw invalid("Invalid financial query parameter");
  if (type !== "transactions" && (issue !== undefined || dateField !== undefined) || type !== "webhooks" && transactionId !== undefined ||
      type !== "bookings" && view !== undefined || !["transactions", "bookings"].includes(type) && service !== undefined) throw invalid("Unsupported financial filter");
  if (dateField && !["createdAt", "paidAt"].includes(dateField)) throw invalid("Invalid transaction date field");
  const linkedHistory = range === "all" && type === "webhooks" && transactionId !== undefined && from === undefined && to === undefined;
  const dates = linkedHistory ? null : financialRange({ range, from, to }, now);
  const { search } = rest;
  if (search !== undefined && (typeof search !== "string" || search.length > 100)) throw invalid("Invalid search");
  const term = search?.trim();
  const key = type !== "webhooks" && term && exact(term, type);
  if (key || type === "webhooks") delete rest.search;
  const result = listQuery(rest, specification, finalFixed);
  if (key) {
    if (!safeText.test(term)) throw invalid("Invalid financial identifier");
    result.filter[key] = key === "receiptNumber" ? term.toUpperCase() : term;
  }
  if (type === "webhooks" && term) {
    if (!safeText.test(term)) throw invalid("Invalid event ID");
    result.filter.eventId = term;
  }
  if (type === "transactions" && term?.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+$/.test(term)) throw invalid("Enter a complete email address");
    delete result.filter.$or;
    result.filter.email = term.toLowerCase();
  }
  if (service !== undefined) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service) || service.length > 80) throw invalid("Invalid service slug");
    result.filter.serviceSlug = service;
  }
  if (transactionId !== undefined) result.filter.transactionId = objectId(transactionId);
  if (result.filter.failureCategory === "unclassified") result.filter.failureCategory = { $nin: [...failureCategories, null, ""] };
  if (result.filter.eventType === "other") result.filter.eventType = { $nin: webhookTypes };
  if (dates) result.filter[dateField || "createdAt"] = rangeFilter(dates);
  if (view !== undefined) {
    if (!["recorded", "paid", "upcoming", "historical", "review"].includes(view)) throw invalid("Invalid booking view");
    if (view === "paid") {
      if (result.filter.paymentStatus && result.filter.paymentStatus !== "paid") throw invalid("Conflicting booking status");
      result.filter.paymentStatus = "paid";
      delete result.filter.createdAt;
      result.filter.paidAt = rangeFilter(dates);
    }
    if (view === "upcoming" || view === "historical") {
      delete result.filter.createdAt;
      if (view === "upcoming" && dates.to <= now && (range || to)) {
        throw invalid("Use the operational date window for upcoming preferred dates");
      }
      const today = financialRange({ range: "today" }, now).from;
      const boundary = view === "upcoming" ? { $gte: today, $lt: new Date(+today + 180 * 86400000) } :
        { $gte: dates.from, $lt: new Date(Math.min(+today, +dates.to)) };
      result.filter.preferredDate = boundary;
    }
  }
  if (issue) {
    const checks = {
      "missing-receipt": { status: "paid", ...missingReceipt },
      "receipt-failed": { receiptEmailStatus: "failed" },
      "admin-failed": { adminEmailStatus: "failed" },
      "incomplete-email": { status: "paid", $or: [
        { receiptEmailStatus: null }, { adminEmailStatus: null },
        { receiptEmailStatus: "sent", receiptEmailSentAt: null }, { adminEmailStatus: "sent", adminEmailSentAt: null },
        { receiptEmailStatus: { $ne: "sent" }, receiptEmailSentAt: { $type: "date" } },
        { adminEmailStatus: { $ne: "sent" }, adminEmailSentAt: { $type: "date" } },
      ] },
      "stale-email": { $or: [
        { receiptEmailStatus: "processing", receiptEmailClaimedAt: { $lt: ageAt(now, claimMs) } },
        { adminEmailStatus: "processing", adminEmailClaimedAt: { $lt: ageAt(now, claimMs) } },
      ] },
    };
    if (!Object.hasOwn(checks, issue)) throw invalid("Invalid receipt issue");
    result.filter = { $and: [result.filter, checks[issue]] };
  }
  return { ...result, dates, view };
}
const transactionQuery = (query, now, fixed = {}) => parse(query, txSpec, { provider: "razorpay", ...fixed }, now, "transactions");
const bookingQuery = (query, now) => parse(query, bookingSpec, {}, now, "bookings");
const webhookQuery = (query, now) => parse(query, webhookSpec, { provider: "razorpay" }, now, "webhooks");
const legacyQuery = (query, now) => parse(query, legacySpec, {}, now, "legacy");

module.exports = { financialRange, transactionQuery, bookingQuery, webhookQuery, legacyQuery, rangeFilter, objectId, only };
