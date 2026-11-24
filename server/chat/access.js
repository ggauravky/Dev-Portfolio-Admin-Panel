const { HttpError } = require("../utils/http");

const maxTimeMS = 2400;
const activeLimit = 4;

function createChatAccess(db) {
  let active = 0;
  async function run(collection, operation) {
    if (active >= activeLimit) throw new HttpError(503, "CHAT_BUSY", "Chat monitoring is busy. Try again shortly.");
    active++;
    try {
      await db.connect?.("chat");
      const database = db.get("chat");
      if (!database) {
        const missing = db.status().chat === "not_configured";
        throw new HttpError(503, missing ? "CHAT_NOT_CONFIGURED" : "CHAT_UNAVAILABLE",
          missing ? "Chat storage is not configured." : "Chat storage is temporarily unavailable.");
      }
      if (db.hasCollection?.("chat", collection) === false) throw new HttpError(503, "CHAT_COLLECTION_UNAVAILABLE", "Collection is missing or its read permission is unavailable.");
      return await operation(database.collection(collection));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code === 13) throw new HttpError(503, "CHAT_PERMISSION", "Chat read permission is unavailable.");
      if (error.code === 50 || error.code === 262 || error.name === "MongoOperationTimeoutError") {
        throw new HttpError(503, "CHAT_TIMEOUT", "The chat query timed out. Try a shorter date range.");
      }
      if (/Mongo(Network|ServerSelection|NotConnected)/.test(error.name)) db.invalidate?.("chat");
      throw new HttpError(503, "CHAT_UNAVAILABLE", "Chat storage is temporarily unavailable.");
    } finally { active--; }
  }
  const aggregate = (stages) => run("chat_turns", (collection) =>
    collection.aggregate(stages, { maxTimeMS, allowDiskUse: false }).toArray());
  return { run, aggregate };
}

function shortCache({ ttl = 45_000, cap = 24 } = {}) {
  const entries = new Map();
  return async (key, load) => {
    const current = entries.get(key);
    if (current && current.expires > Date.now()) return current.promise;
    if (entries.size >= cap) entries.delete(entries.keys().next().value);
    const entry = { expires: Date.now() + ttl, promise: Promise.resolve().then(load) };
    entries.set(key, entry);
    try { return await entry.promise; } catch (error) {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    }
  };
}

module.exports = { createChatAccess, maxTimeMS, shortCache };
