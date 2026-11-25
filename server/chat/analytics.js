const { reportingRange, only, zone, groupIdentity, categorical, dimensions } = require("./query");
const { shortCache } = require("./access");

const width = 50;
const histogramCap = 120000;
const validLatency = { $and: [
  { $isNumber: "$latencyMs" }, { $gte: ["$latencyMs", 0] }, { $lt: ["$latencyMs", 86400000] },
  { $ne: ["$aborted", true] },
] };
const track = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const is = (field, value) => ({ $eq: ["$" + field, value] });
const numericRate = (top, base) => base ? top / base : null;
const count = [{ $count: "count" }];
const grouped = (field) => [{ $group: { _id: "$" + field, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }];
const history = { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: zone } };
const eligible = { $in: ["$retrieval", ["hybrid", "keyword", "about"]] };
const observed = (name) => ({ $eq: [{ $type: "$" + name }, "bool"] });

function scope(range) {
  return [
    { $match: { createdAt: { $gte: range.from, $lt: range.to } } },
    { $project: {
      day: history, identity: groupIdentity, provider: categorical("$provider", dimensions.provider),
      intent: categorical("$intent", dimensions.intent), retrieval: categorical("$retrieval", dimensions.retrieval),
      cached: 1, matched: 1, aborted: 1, latencyMs: 1,
    } },
  ];
}
function distinct(key) {
  return [{ $group: { _id: key } }, ...count];
}
function totals() {
  return { _id: null, turns: { $sum: 1 }, hits: track(is("cached", true)), misses: track(is("cached", false)),
    matched: track(is("matched", true)), unmatched: track(is("matched", false)),
    eligibleMatched: track({ $and: [eligible, is("matched", true)] }),
    eligibleObserved: track({ $and: [eligible, observed("matched")] }),
    aborted: track(is("aborted", true)), abortedObserved: track(observed("aborted")),
    local: track({ $in: ["$provider", ["faq", "canned", "template"]] }),
    templates: track(is("provider", "template")),
    declined: track(is("intent", "declined")), unsupported: track(is("intent", "nomatch")),
  };
}
function coreStages(range) {
  return [...scope(range), { $facet: {
    totals: [{ $group: totals() }],
    conversations: distinct("$identity"),
    providers: grouped("provider"), intents: grouped("intent"), retrieval: grouped("retrieval"),
    daily: [{ $group: { _id: "$day", turns: { $sum: 1 }, hits: track(is("cached", true)), misses: track(is("cached", false)) } }],
    dailyConversations: [{ $group: { _id: { day: "$day", identity: "$identity" } } }, { $group: { _id: "$_id.day", count: { $sum: 1 } } }],
    dailyProviders: [{ $group: { _id: { day: "$day", provider: "$provider" }, count: { $sum: 1 } } }],
  } }];
}

const latencyFields = { count: { $sum: 1 }, averageMs: { $avg: "$latencyMs" }, minMs: { $min: "$latencyMs" }, maxMs: { $max: "$latencyMs" } };
const bins = [{ $group: { _id: { $min: [histogramCap, { $multiply: [width, { $floor: { $divide: ["$latencyMs", width] } }] }] }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }];

function latencyStages(range) {
  return [...scope(range), { $match: { $expr: validLatency } }, { $facet: {
    total: [{ $group: { _id: null, ...latencyFields } }],
    bins,
    daily: [{ $group: { _id: "$day", ...latencyFields } }, { $sort: { _id: 1 } }],
    providers: [{ $group: { _id: "$provider", ...latencyFields } }, { $sort: { _id: 1 } }],
  } }];
}
function percentile(rows, total, quantile) {
  if (!total) return null;
  const target = Math.ceil(total * quantile);
  let current = 0;
  for (const row of rows) {
    current += row.count;
    if (current >= target) return row._id;
  }
  return null;
}
function formatLatency(data) {
  const { _id, count: total = 0, averageMs = null, minMs = null, maxMs = null } = data?.total?.[0] || {};
  const flatten = (rows) => (rows || []).map(({ _id: key, ...row }) => ({ key, ...row }));
  return { count: total, averageMs, minMs, maxMs, medianMs: percentile(data?.bins || [], total, 0.5),
    p95Ms: percentile(data?.bins || [], total, 0.95), bucketMs: width, overflowMs: histogramCap,
    daily: flatten(data?.daily), providers: flatten(data?.providers) };
}
function formatCore(result) {
  const { _id, turns = 0, hits = 0, misses = 0, matched = 0, unmatched = 0, eligibleMatched = 0, eligibleObserved = 0,
    aborted = 0, abortedObserved = 0, local = 0, templates = 0, declined = 0, unsupported = 0 } = result?.totals?.[0] || {};
  const conversations = result?.conversations?.[0]?.count ?? 0;
  const dailyConversations = new Map((result?.dailyConversations || []).map(({ _id: key, count: value }) => [key, value]));
  const typesByDay = Object.groupBy(result?.dailyProviders || [], (row) => row._id.day);
  const distribution = (rows) => (rows || []).map(({ _id: key, count: value }) => ({ key, count: value, fraction: numericRate(value, turns) }));
  return {
    turns, conversations, averageTurns: numericRate(turns, conversations), local, templates, declined, unsupported,
    cache: { hits, misses, rate: numericRate(hits, hits + misses) },
    retrieval: { matched, unmatched, allRate: numericRate(matched, matched + unmatched), eligibleMatched, eligibleObserved, eligibleRate: numericRate(eligibleMatched, eligibleObserved) },
    aborted: { count: aborted, observed: abortedObserved, rate: numericRate(aborted, abortedObserved) },
    distributions: { response: distribution(result?.providers), intent: distribution(result?.intents), retrieval: distribution(result?.retrieval) },
    daily: (result?.daily || []).sort((a, b) => a._id.localeCompare(b._id)).map(({ _id: day, turns: recorded, hits: h, misses: m }) => ({
      day, turns: recorded, conversations: dailyConversations.get(day) || 0, hits: h, misses: m, cacheRate: numericRate(h, h + m),
      responseTypes: (typesByDay[day] || []).map((row) => ({ key: row._id.provider, count: row.count, fraction: numericRate(row.count, recorded) })),
    })),
  };
}

function createAnalytics(access, now) {
  const cache = shortCache();
  const observed = () => now();
  const key = (range) => +range.from + ":" + +range.to;
  return {
    async full(query) {
      only(query, ["range", "from", "to"]);
      const range = reportingRange(query, now(), "7d");
      const parts = await Promise.allSettled([
        cache("core:" + key(range), async () => ({ data: formatCore((await access.aggregate(coreStages(range)))[0]), observedAt: observed() })),
        cache("latency:" + key(range), async () => ({ data: formatLatency((await access.aggregate(latencyStages(range)))[0]), observedAt: observed() })),
      ]);
      if (parts.every((result) => result.status === "rejected")) throw parts[0].reason;
      const safe = (result) => result.status === "fulfilled"
        ? { status: "available", ...result.value }
        : { status: "unavailable", code: result.reason.code, message: result.reason.message };
      return { range, core: safe(parts[0]), latency: safe(parts[1]) };
    },
    summary() {
      const range = reportingRange({ range: "7d" }, now());
      return cache("summary:" + key(range), async () => {
        const [row] = await access.aggregate([...scope(range), { $facet: {
          totals: [{ $group: { _id: null, turns: { $sum: 1 }, hits: track(is("cached", true)), misses: track(is("cached", false)) } }],
          conversations: distinct("$identity"),
          bins: [{ $match: { $expr: validLatency } }, ...bins],
        } }]);
        const counts = row?.totals?.[0];
        return { turns: counts?.turns || 0, conversations: row?.conversations?.[0]?.count || 0,
          cacheRate: numericRate(counts?.hits, (counts?.hits || 0) + (counts?.misses || 0)),
          medianMs: percentile(row?.bins || [], (row?.bins || []).reduce((sum, item) => sum + item.count, 0), 0.5),
          bucketMs: width, overflowMs: histogramCap, range, observedAt: observed() };
      });
    },
  };
}
module.exports = { createAnalytics, percentile };
