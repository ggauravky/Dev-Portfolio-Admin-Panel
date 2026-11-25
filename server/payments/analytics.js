const { financialRange, rangeFilter, only } = require("./query");
const { optional } = require("./access");
const { validPaise, decimalPaise, txStatus, webhookStatus, failureCategories } = require("./model");
const { shortCache } = require("../chat/access");
const { zone } = require("../chat/query");

const equals = (key, value) => ({ $eq: ["$" + key, value] });
const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const sumPaise = (condition = true) => ({ $sum: { $cond: [{ $and: [condition, validPaise] }, decimalPaise, 0] } });
const category = (key, known) => ({ $cond: [{ $in: ["$" + key, known] }, "$" + key, "unclassified"] });
const group = (key, known) => [{ $group: { _id: category(key, known), count: { $sum: 1 } } }, { $sort: { _id: 1 } }];
const day = (key) => ({ $dateToString: { date: "$" + key, format: "%Y-%m-%d", timezone: zone } });
const stringify = (value) => value?.toString() || "0";

function transactionPipeline(range, compact) {
  const dates = rangeFilter(range);
  const attempts = { $match: { createdAt: dates } };
  const paid = { $match: { status: "paid", paidAt: dates } };
  const states = Object.fromEntries(txStatus.map((status) => [status, countIf(equals("status", status))]));
  const paidTotals = {
    _id: null, total: { $sum: 1 }, valid: countIf(validPaise), paidPaise: sumPaise(),
    servicePaise: sumPaise(equals("flowType", "service")), supportPaise: sumPaise(equals("flowType", "support")),
    supportCount: countIf(equals("flowType", "support")),
    invalidFlow: countIf({ $not: [{ $in: ["$flowType", ["service", "support"]] }] }),
  };
  const attemptTotals = {
    _id: null, total: { $sum: 1 }, ...states,
    pendingService: countIf({ $and: [equals("status", "pending"), equals("flowType", "service")] }),
    supportCount: countIf(equals("flowType", "support")),
    pendingSupport: countIf({ $and: [equals("status", "pending"), equals("flowType", "support")] }),
    pendingPaise: sumPaise(equals("status", "pending")),
    pendingInvalid: countIf({ $and: [equals("status", "pending"), { $not: [validPaise] }] }),
    receiptFailures: countIf(equals("receiptEmailStatus", "failed")), adminFailures: countIf(equals("adminEmailStatus", "failed")),
  };
  const facets = {
    attempts: [attempts, { $group: attemptTotals }],
    paid: [paid, { $group: paidTotals }],
  };
  if (!compact) Object.assign(facets, {
    status: [attempts, ...group("status", txStatus)],
    failureCategories: [attempts, { $match: { status: "failed" } }, ...group("failureCategory", failureCategories)],
    dailyAttempts: [attempts, { $group: { _id: day("createdAt"), count: { $sum: 1 }, failed: countIf(equals("status", "failed")) } }, { $sort: { _id: 1 } }],
    dailyPaid: [paid, { $group: { _id: day("paidAt"), count: { $sum: 1 }, paise: sumPaise(), valid: countIf(validPaise) } }, { $sort: { _id: 1 } }],
  });
  return [
    { $match: { provider: "razorpay", $or: [{ createdAt: dates }, { status: "paid", paidAt: dates }] } },
    { $project: { createdAt: 1, paidAt: 1, status: 1, flowType: 1, amount: 1, amountPaise: 1, currency: 1, failureCategory: 1, receiptEmailStatus: 1, adminEmailStatus: 1 } },
    { $facet: facets },
  ];
}

function shapeTransactions(result) {
  const a = result?.attempts?.[0] || {};
  const p = result?.paid?.[0] || {};
  const rows = (items) => (items || []).map(({ _id: key, ...rest }) => ({ key, ...rest }));
  return {
    attempts: { total: a.total || 0, ...Object.fromEntries(txStatus.map((state) => [state, a[state] || 0])),
      pendingService: a.pendingService || 0, pendingPaise: stringify(a.pendingPaise), pendingInvalid: a.pendingInvalid || 0,
      supportCount: a.supportCount || 0, pendingSupport: a.pendingSupport || 0,
      receiptFailures: a.receiptFailures || 0, adminFailures: a.adminFailures || 0 },
    paid: { count: p.total || 0, supportCount: p.supportCount || 0, valid: p.valid || 0, excluded: (p.total || 0) - (p.valid || 0), invalidFlow: p.invalidFlow || 0,
      totalPaise: stringify(p.paidPaise), servicePaise: stringify(p.servicePaise), supportPaise: stringify(p.supportPaise) },
    statuses: rows(result?.status), failureCategories: rows(result?.failureCategories),
    dailyAttempts: rows(result?.dailyAttempts),
    dailyPaid: rows(result?.dailyPaid).map((row) => ({ ...row, paise: stringify(row.paise) })),
    refundAmountPaise: null, netRevenuePaise: null, paymentMode: "unverified", currency: "INR",
  };
}

function createFinancialAnalytics(access, now) {
  const cache = shortCache({ ttl: 30000, cap: 24 });
  async function report(query, compact = false) {
    only(query, ["range", "from", "to"]);
    const asOf = now();
    const dates = financialRange(query, asOf);
    const key = +dates.from + ":" + +dates.to + ":" + compact;
    return cache(key, async () => {
      const filter = rangeFilter(dates);
      const [transactions, bookings, webhooks] = await Promise.all([
        optional(async () => shapeTransactions((await access.aggregate("transactions", transactionPipeline(dates, compact)))[0])),
        optional(async () => {
          const [result] = await access.aggregate("bookings", [
            { $match: { $or: [{ createdAt: filter }, { paymentProvider: "razorpay", paymentStatus: "paid", paidAt: filter }] } },
            { $facet: {
              recorded: [{ $match: { createdAt: filter } }, ...group("paymentStatus", ["created", "pending", "paid", "failed"])],
              paid: [{ $match: { paymentProvider: "razorpay", paymentStatus: "paid", paidAt: filter } }, { $count: "count" }],
            } },
          ]);
          const observed = result?.recorded || [];
          return { total: observed.reduce((sum, row) => sum + row.count, 0),
            confirmedPaid: result?.paid?.[0]?.count || 0,
            ...Object.fromEntries(["created", "pending", "failed"].map((state) => [state, observed.find((row) => row._id === state)?.count || 0])) };
        }),
        optional(async () => {
          const rows = await access.aggregate("webhooks", [{ $match: { $or: [{ provider: "razorpay", createdAt: filter },
            { provider: { $exists: false }, eventKey: { $type: "string" }, receivedAt: filter }] } }, ...group("status", webhookStatus)]);
          const states = Object.fromEntries(rows.map((row) => [row._id, row.count]));
          return { total: rows.reduce((sum, row) => sum + row.count, 0), ...Object.fromEntries(webhookStatus.map((state) => [state, states[state] || 0])), unclassified: states.unclassified || 0 };
        }),
      ]);
      return { dates, observedAt: asOf, transactions, bookings, webhooks };
    });
  }
  return { full: report, summary: () => report({ range: "7d" }, true) };
}

module.exports = { createFinancialAnalytics };
