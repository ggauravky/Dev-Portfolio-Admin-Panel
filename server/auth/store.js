const { HttpError } = require("../utils/http");

const collections = {
  sessions: "admin_sessions",
  rates: "admin_auth_limits",
  audit: "admin_security_audit",
};
const indexes = {
  sessions: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    { key: { owner: 1, credentialVersion: 1, createdAt: -1 } },
  ],
  rates: [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  audit: [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }, { key: { createdAt: -1 } }],
};
const options = { maxTimeMS: 2000 };
const authUnavailable = () => new HttpError(503, "AUTH_UNAVAILABLE", "Administrator authentication is temporarily unavailable");

function createSecurityStore(db) {
  async function access(name, operation) {
    try {
      await db.connect?.("admin");
      const database = db.get("admin");
      if (!database) throw authUnavailable();
      return await operation(database.collection(collections[name]));
    } catch (error) {
      if (/Mongo(Network|ServerSelection|NotConnected)/.test(error.name)) db.invalidate?.("admin");
      throw authUnavailable();
    }
  }

  const active = (at) => ({ revokedAt: null, idleExpiresAt: { $gt: at }, expiresAt: { $gt: at } });
  return {
    create: (record) => access("sessions", (c) => c.insertOne(record)),
    lookup: (tokenHash) => access("sessions", (c) => c.findOne({ tokenHash }, options)),
    touch: (id, old, at, idleExpiresAt) => access("sessions", async (c) =>
      (await c.updateOne({ _id: id, lastActivityAt: old, ...active(at) }, { $set: { lastActivityAt: at, idleExpiresAt } }, options)).matchedCount > 0),
    list: (owner, credentialVersion, at) => access("sessions", (c) =>
      c.find({ owner, credentialVersion, ...active(at) }, {
        ...options, projection: { _id: 1, createdAt: 1, lastActivityAt: 1, idleExpiresAt: 1, expiresAt: 1 },
      }).sort({ createdAt: -1, _id: 1 }).limit(100).toArray()),
    revoke: (owner, credentialVersion, selector, at) => access("sessions", (c) =>
      c.updateMany({ ...selector, owner, credentialVersion, revokedAt: null }, { $set: { revokedAt: at } }, options)),
    reserve: (id, maximum, expiresAt) => access("rates", async (c) => {
      try {
        // The built-in unique _id index prevents two upserts from minting separate counters.
        await c.updateOne({ _id: id, count: { $lt: maximum } },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { ...options, upsert: true });
        return true;
      } catch (error) {
        if (error.code === 11000) {
          const result = await c.updateOne({ _id: id, count: { $lt: maximum } }, { $inc: { count: 1 } }, options);
          return result.matchedCount > 0;
        }
        throw error;
      }
    }),
    audit: (record) => access("audit", async (c) => {
      try { await c.insertOne(record); } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }),
  };
}

function sameIndexKey(actual, required) {
  return JSON.stringify(actual.key) === JSON.stringify(required.key);
}

function matchesSecurityIndex(actual, required) {
  return sameIndexKey(actual, required) &&
    Boolean(actual.unique) === Boolean(required.unique) &&
    actual.expireAfterSeconds === required.expireAfterSeconds &&
    !actual.sparse && !actual.partialFilterExpression && !actual.collation && !actual.hidden;
}

async function verifySecurityIndexes(database) {
  await Promise.all(Object.entries(indexes).map(async ([name, required]) => {
    const actual = await database.collection(collections[name]).listIndexes(options).toArray();
    if (!required.every((wanted) => actual.some((index) => matchesSecurityIndex(index, wanted)))) {
      throw new Error("Admin security indexes are incomplete");
    }
  }));
}

module.exports = { createSecurityStore, verifySecurityIndexes, authUnavailable, collections, indexes, sameIndexKey, matchesSecurityIndex };
