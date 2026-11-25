const { invalid, missing } = require("../utils/http");
const { maxTimeMS } = require("./access");
const { uuid, paired, turnQuery, groupIdentity, textField, categorical, dimensions, only } = require("./query");
const { resolveSources } = require("./knowledge");

const fields = ["_id", "question", "answer", "intent", "chunkIds", "retrieval", "matched", "provider", "cached", "latencyMs", "aborted", "corpusVersion", "createdAt"];
const projection = Object.fromEntries(fields.map((field) => [field, 1]));
const options = { projection, maxTimeMS };

function safeTurn(record) {
  const safe = Object.fromEntries(fields.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
  for (const key of ["provider", "intent", "retrieval", "corpusVersion"]) safe[key] = typeof safe[key] === "string" ? safe[key].slice(0, 80) : null;
  for (const key of ["cached", "matched", "aborted"]) if (typeof safe[key] !== "boolean") safe[key] = null;
  safe.question = typeof safe.question === "string" ? safe.question.slice(0, 5000) : "";
  safe.answer = typeof safe.answer === "string" ? safe.answer.slice(0, 20000) : "";
  safe.latencyMs = Number.isFinite(safe.latencyMs) && safe.latencyMs >= 0 ? safe.latencyMs : null;
  safe.chunkIds = Array.isArray(safe.chunkIds) ? safe.chunkIds.filter((id) => typeof id === "string").slice(0, 40).map((id) => id.slice(0, 240)) : [];
  safe.sources = resolveSources(safe.corpusVersion, safe.chunkIds);
  safe.conversationReference = safe._id;
  return safe;
}

function page(query, items, total) {
  return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.min(Math.ceil(total / query.pageSize), Math.floor(10000 / query.pageSize) + 1) };
}

async function identity(collection, reference) {
  const anchor = await collection.findOne({ _id: uuid(reference) }, { projection: { _id: 1, sessionId: 1, owner: 1 }, maxTimeMS });
  if (!anchor) throw missing();
  return paired(anchor) ? { sessionId: anchor.sessionId, owner: anchor.owner } : { _id: anchor._id };
}

async function fetchPage(collection, query, filter, sort = query.sort) {
  const [items, total] = await Promise.all([
    collection.find(filter, options).sort(sort).skip(query.skip).limit(query.pageSize).toArray(),
    collection.countDocuments(filter, { maxTimeMS }),
  ]);
  return page(query, items.map(safeTurn), total);
}

function createConversations(access, now) {
  return {
    turns(query) {
      const q = turnQuery(query, now());
      return access.run("chat_turns", async (collection) =>
        fetchPage(collection, q, { ...q.filter, ...(q.conversation ? await identity(collection, q.conversation) : {}) }));
    },
    async turn(id) {
      const _id = uuid(id);
      const record = await access.run("chat_turns", (collection) => collection.findOne({ _id }, options));
      if (!record) throw missing();
      return safeTurn(record);
    },
    async list(query) {
      const q = turnQuery(query, now());
      if (q.conversation || (query.sortBy && query.sortBy !== "createdAt")) throw invalid("Unsupported conversation sorting or filter");
      const [result] = await access.aggregate([
        { $match: q.filter },
        { $project: { sessionId: 1, owner: 1, createdAt: 1, question: 1, provider: 1, intent: 1, cached: 1, aborted: 1 } },
        { $sort: { createdAt: 1, _id: 1 } },
        { $group: {
          _id: groupIdentity, reference: { $first: "$_id" }, firstAt: { $first: "$createdAt" }, lastAt: { $last: "$createdAt" },
          turns: { $sum: 1 }, preview: { $first: { $substrCP: [textField("$question"), 0, 160] } },
          latestResponseType: { $last: { $substrCP: [textField("$provider"), 0, 80] } },
          intents: { $addToSet: categorical("$intent", dimensions.intent) },
          cachedTurns: { $sum: { $cond: [{ $eq: ["$cached", true] }, 1, 0] } },
          cacheObserved: { $sum: { $cond: [{ $eq: [{ $type: "$cached" }, "bool"] }, 1, 0] } },
          abortedTurns: { $sum: { $cond: [{ $eq: ["$aborted", true] }, 1, 0] } },
        } },
        { $unset: "_id" },
        { $facet: {
          items: [{ $sort: { lastAt: query.order === "asc" ? 1 : -1, reference: 1 } }, { $skip: q.skip }, { $limit: q.pageSize }],
          count: [{ $count: "total" }],
        } },
      ]);
      return page(q, result?.items || [], result?.count?.[0]?.total || 0);
    },
    details(reference, query) {
      uuid(reference);
      only(query, ["page", "pageSize", "range", "from", "to"]);
      const q = turnQuery(query, now());
      return access.run("chat_turns", async (collection) =>
        fetchPage(collection, q, { ...q.filter, ...(await identity(collection, reference)) }, { createdAt: 1, _id: 1 }));
    },
  };
}

module.exports = { createConversations, safeTurn };
