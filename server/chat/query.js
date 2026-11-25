const { invalid } = require("../utils/http");
const { listQuery } = require("../repositories/reads");

const zone = "Asia/Kolkata";
const dayMs = 86400000;
const istDay = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownerPattern = /^[a-f0-9]{32}$/;
const corpusPattern = /^[a-f0-9]{16}$/;
const dimensions = require("../contracts/chat-values.json");
const chatSpec = {
  search: "question answer", sort: "createdAt latencyMs",
  filters: { cached: [true, false], matched: [true, false], aborted: [true, false] },
};

function uuid(value) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw invalid("Invalid UUID");
  return value.toLowerCase();
}

function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid("Use YYYY-MM-DD dates");
  const timestamp = new Date(value + "T00:00:00+05:30");
  if (!Number.isFinite(+timestamp) || istDay.format(timestamp) !== value) throw invalid("Invalid calendar date");
  return timestamp;
}

const allTime = new Date(Date.UTC(2000, 0, 1));

function reportingRange(query, now = new Date(), defaultRange = "30d", { allowMonth = false, allowHistory = false, allowAll = false } = {}) {
  const { range, from, to } = query;
  const today = day(istDay.format(now));
  const end = new Date(+today + dayMs);
  let start;
  let stop = end;
  const preset = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
  if (from !== undefined || to !== undefined || range === "custom") {
    if (range !== undefined && range !== "custom") throw invalid("Choose a preset or custom dates");
    start = day(from);
    stop = new Date(+day(to) + dayMs);
  } else {
    const mode = range === undefined ? defaultRange : range;
    // Complete recorded history for registries; results stay paginated and query time stays bounded.
    if (allowAll && mode === "all") return { from: allTime, to: end, timezone: zone, all: true };
    if (allowMonth && mode === "month") start = day(istDay.format(now).slice(0, 7) + "-01");
    else {
      if (typeof mode !== "string" || !Object.hasOwn(preset, mode)) throw invalid("Unsupported report range");
      start = new Date(+end - preset[mode] * dayMs);
    }
  }
  if ((!allowHistory && start < +end - 180 * dayMs) || +stop - +start > 180 * dayMs || stop > end || start >= stop) {
    throw invalid("Choose a range of up to 180 days ending no later than today");
  }
  return { from: start, to: stop, timezone: zone };
}

function only(query, keys) {
  if (Object.keys(query).some((key) => !keys.includes(key) || typeof query[key] !== "string")) throw invalid("Unsupported query parameter");
}

function turnQuery(query, now) {
  const { range, from, to, conversation, corpusVersion, provider, intent, retrieval: mode, ...pagination } = query;
  const result = listQuery(pagination, chatSpec, {});
  const dates = reportingRange({ range, from, to }, now);
  result.filter.createdAt = { $gte: dates.from, $lt: dates.to };
  if (conversation !== undefined) result.conversation = uuid(conversation);
  if (corpusVersion !== undefined) {
    if (typeof corpusVersion !== "string" || !corpusPattern.test(corpusVersion)) throw invalid("Invalid corpus version");
    result.filter.corpusVersion = corpusVersion;
  }
  for (const [name, value] of Object.entries({ provider, intent, retrieval: mode })) {
    if (value === undefined) continue;
    if (value === "unknown") result.filter[name] = { $nin: dimensions[name] };
    else if (dimensions[name].includes(value)) result.filter[name] = value;
    else throw invalid("Unsupported chat filter");
  }
  return { ...result, dates };
}

function paired(record) {
  return typeof record.owner === "string" && ownerPattern.test(record.owner) &&
    typeof record.sessionId === "string" && uuidPattern.test(record.sessionId);
}

const textField = (path) => ({ $cond: [{ $eq: [{ $type: path }, "string"] }, path, ""] });
const groupIdentity = {
  $cond: [
    { $and: [
      { $regexMatch: { input: textField("$owner"), regex: ownerPattern } },
      { $regexMatch: { input: textField("$sessionId"), regex: uuidPattern } },
    ] },
    { session: "$sessionId", binding: "$owner" },
    { anchor: "$_id" },
  ],
};
const categorical = (field, known) => ({ $cond: [{ $in: [field, known] }, field, "unknown"] });

module.exports = { zone, dayMs, istDay, reportingRange, only, turnQuery, uuid, paired, groupIdentity, textField, categorical, dimensions, corpusPattern };
