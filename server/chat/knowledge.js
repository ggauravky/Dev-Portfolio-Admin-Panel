const manifest = require("../contracts/portfolio-chat-corpus.json");
const { reportingRange, only, corpusPattern, textField } = require("./query");
const { invalid } = require("../utils/http");
const { shortCache } = require("./access");

const byId = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
const typeCounts = Object.fromEntries([...new Set(manifest.chunks.map(({ type }) => type))]
  .map((type) => [type, manifest.chunks.filter((chunk) => chunk.type === type).length]));
const { chunks, ...metadata } = manifest;

function resolveSources(version, ids) {
  return ids.map((id) => {
    const chunk = version === manifest.version ? byId.get(id) : null;
    return chunk ? { ...chunk, mapping: "verified" } : { id, mapping: "unavailable" };
  });
}

function createKnowledge(access, now) {
  const cache = shortCache();
  return async function knowledge(query) {
    only(query, ["range", "from", "to", "page", "sourceType"]);
    const range = reportingRange(query, now(), "7d");
    if (query.sourceType !== undefined && !Object.hasOwn(typeCounts, query.sourceType)) throw invalid("Unknown source type");
    if (query.page !== undefined && !/^[1-9]\d{0,2}$/.test(query.page)) throw invalid("Invalid page");
    const page = Number(query.page || 1);
    const filtered = query.sourceType ? chunks.filter((row) => row.type === query.sourceType) : chunks;
    let observations;
    try {
      observations = await cache(String(+range.from) + ":" + String(+range.to), async () => {
        const [result] = await access.aggregate([
          { $match: { createdAt: { $gte: range.from, $lt: range.to } } },
          { $project: { corpusVersion: 1, chunkIds: 1 } },
          { $facet: {
            versions: [
              { $group: { _id: { $cond: [{ $regexMatch: { input: textField("$corpusVersion"), regex: corpusPattern } }, "$corpusVersion", "unknown"] }, count: { $sum: 1 } } },
              { $sort: { count: -1, _id: 1 } }, { $limit: 20 },
            ],
            retrieved: [
              { $match: { corpusVersion: manifest.version } },
              { $project: { matches: { $setIntersection: [{ $cond: [{ $isArray: "$chunkIds" }, "$chunkIds", []] }, chunks.map(({ id }) => id)] } } },
              { $unwind: "$matches" }, { $group: { _id: "$matches", count: { $sum: 1 } } },
              { $sort: { count: -1, _id: 1 } }, { $limit: 20 },
            ],
          } },
        ]);
        return { status: "available", observedAt: now(), versions: (result?.versions || []).map(({ _id, count }) => ({ version: _id, count })),
          retrieved: (result?.retrieved || []).map(({ _id, count }) => ({ ...byId.get(_id), count })) };
      });
    } catch (error) {
      observations = { status: "unavailable", code: error.code, message: error.message };
    }
    return { ...metadata, typeCounts, dateRange: range, observations,
      catalog: { items: filtered.slice((page - 1) * 20, page * 20), page, total: filtered.length, totalPages: Math.ceil(filtered.length / 20) } };
  };
}

module.exports = { resolveSources, createKnowledge };
