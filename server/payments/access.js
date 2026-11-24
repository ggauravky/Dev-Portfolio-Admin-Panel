const { HttpError } = require("../utils/http");

const collections = { transactions: "paymenttransactions", bookings: "bookings", webhooks: "paymentwebhookevents", legacy: "supportpayments" };
const maxTimeMS = 2000;

function createAccess(db) {
  let active = 0;
  async function run(kind, query) {
    if (active >= 8) throw new HttpError(503, "FINANCIAL_BUSY", "Financial reads are busy. Try again shortly.");
    active++;
    try {
      await db.connect?.("primary");
      const database = db.get("primary");
      if (!database) throw new HttpError(503, "FINANCIAL_UNAVAILABLE", "Portfolio financial storage is unavailable.");
      const name = collections[kind];
      if (db.hasCollection?.("primary", name) === false) {
        throw new HttpError(503, "FINANCIAL_COLLECTION_UNAVAILABLE", "The collection is missing or its read permission is unavailable.");
      }
      return await query(database.collection(name));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code === 13) throw new HttpError(503, "FINANCIAL_PERMISSION", "Financial read permission is unavailable.");
      if (error.code === 50 || error.code === 262 || error.name === "MongoOperationTimeoutError") {
        throw new HttpError(503, "FINANCIAL_TIMEOUT", "The financial query timed out. Narrow the filters and retry.");
      }
      if (/Mongo(Network|ServerSelection|NotConnected)/.test(error.name)) db.invalidate?.("primary");
      throw new HttpError(503, "FINANCIAL_UNAVAILABLE", "Portfolio financial storage is unavailable.");
    } finally { active--; }
  }
  return {
    run,
    aggregate: (kind, pipeline) => run(kind, (c) => c.aggregate(pipeline, { maxTimeMS, allowDiskUse: false }).toArray()),
  };
}

async function optional(load) {
  try { return { status: "available", data: await load() }; }
  catch (error) { return { status: "unavailable", code: error.code || "FINANCIAL_UNAVAILABLE", message: error instanceof HttpError ? error.message : "Financial data is unavailable." }; }
}

function page(q, items, total) {
  return { items, total, page: q.page, pageSize: q.pageSize,
    totalPages: Math.min(Math.ceil(total / q.pageSize), Math.floor(10000 / q.pageSize) + 1) };
}

async function list(access, kind, q, projection, map = (row) => row) {
  return access.run(kind, async (c) => {
    const [rows, count] = await Promise.all([
      c.find(q.filter, { projection, maxTimeMS }).sort(q.sort).skip(q.skip).limit(q.pageSize).toArray(),
      c.countDocuments(q.filter, { maxTimeMS }),
    ]);
    return page(q, rows.map(map), count);
  });
}

module.exports = { createAccess, optional, list, page, maxTimeMS };
