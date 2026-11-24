const { collectionRead, listQuery, maxTimeMS } = require("../repositories/reads");
const { collections } = require("../auth/store");
const { financialRange, rangeFilter, only } = require("../payments/query");
const { invalid, missing } = require("../utils/http");

const types = ["login_succeeded", "login_failed", "login_rate_limited", "logout", "session_expired", "session_revocation", "credential_version_observed", "authorization_denied"];
const results = ["allowed", "denied", "requested", "completed"];
const requestPattern = /^[A-Za-z0-9_.-]{1,64}$/;
const eventProjection = { _id: 0, type: 1, result: 1, requestId: 1, category: 1, createdAt: 1, expiresAt: 1 };
const publicEvent = (row) => {
  const type = types.includes(row.type) ? row.type : "unclassified";
  const result = results.includes(row.result) ? row.result : "unclassified";
  const requestId = typeof row.requestId === "string" && requestPattern.test(row.requestId) ? row.requestId : null;
  const key = requestId && types.includes(type) && results.includes(result) && row.createdAt instanceof Date && Number.isFinite(+row.createdAt) ?
    [requestId, type, result, +row.createdAt].join("~") : null;
  return { type, result, requestId, createdAt: row.createdAt, expiresAt: row.expiresAt, category: row.category === "shared_write" ? row.category : null,
    reference: key ? Buffer.from(key).toString("hex") : null };
};

function createAudit(db, now) {
  const access = collectionRead(db, collections.audit, "admin");
  return {
    async list(input) {
      const { range, from, to, requestId, ...params } = input;
      const dates = financialRange({ range, from, to }, now());
      const q = listQuery(params, { sort: "createdAt", filters: { type: types, result: results } }, {});
      if (requestId !== undefined) {
        if (typeof requestId !== "string" || !requestPattern.test(requestId)) throw invalid("Invalid request ID");
        q.filter.requestId = requestId;
      }
      q.filter.createdAt = rangeFilter(dates);
      q.filter.expiresAt = { $gt: now() };
      const [rows, total] = await access((c) => Promise.all([
        c.find(q.filter, { projection: eventProjection, maxTimeMS }).sort(q.sort).skip(q.skip).limit(q.pageSize).toArray(),
        c.countDocuments(q.filter, { maxTimeMS }),
      ]));
      return { items: rows.map(publicEvent), total, page: q.page, pageSize: q.pageSize, totalPages: Math.min(Math.ceil(total / q.pageSize), Math.floor(10000 / q.pageSize) + 1), dates };
    },
    async detail(reference, query) {
      only(query, []);
      if (!/^(?:[0-9a-f]{2}){1,128}$/.test(reference)) throw invalid("Invalid audit reference");
      const [requestId, type, result, timestamp, extra] = Buffer.from(reference, "hex").toString("utf8").split("~");
      if (extra !== undefined || !requestPattern.test(requestId) || !types.includes(type) || !results.includes(result) || !/^\d{1,15}$/.test(timestamp || "")) throw invalid("Invalid audit reference");
      const row = await access((c) => c.findOne({ requestId, type, result, createdAt: new Date(Number(timestamp)), expiresAt: { $gt: now() } }, { projection: eventProjection, maxTimeMS }));
      if (!row) throw missing();
      return publicEvent(row);
    },
  };
}

module.exports = { createAudit };
