const { maxTimeMS, shortCache } = require("./access");
const config = require("../contracts/portfolio-chat-corpus.json");

const limits = {
  groq: { rpm: 25, rpd: 900, tpm: 7000, tpd: 180000 },
  gemini: { rpm: 10, rpd: 200, tpm: 100000, tpd: 400000 },
  embed: { rpm: 60, rpd: 900 },
};
function currentWindows(now) {
  const windows = [];
  const day = now.toISOString().slice(0, 10);
  for (const [label, counters] of Object.entries(limits)) {
    for (const [metric, configuredLimit] of Object.entries(counters)) {
      const daily = metric.endsWith("d");
      const duration = daily ? 86400000 : 60000;
      const key = "q:" + label + ":" + metric + (daily ? ":" + day : "");
      windows.push({ label, metric, key, configuredLimit, duration, windowStart: Math.floor(+now / duration) * duration });
    }
  }
  windows.push({ label: "generation", metric: "starts", key: "q:gen:starts", configuredLimit: 6, duration: 10000, windowStart: Math.floor(+now / 10000) * 10000 });
  return windows;
}

function createOperations(access, db, now) {
  const cache = shortCache({ ttl: 5000, cap: 2 });
  return () => cache(String(Math.floor(+now() / 5000)), async () => {
    const at = now();
    const windows = currentWindows(at);
    const keys = Object.keys(limits);
    const section = async (fn) => {
      try { return { status: "available", data: await fn() }; }
      catch (error) { return { status: "unavailable", code: error.code, message: error.message }; }
    };
    const [quota, cooldowns, cacheEntries] = await Promise.all([
      section(() => access.run("chat_rate", async (collection) => {
        const rows = await collection.find({
          $or: windows.map(({ key, windowStart }) => ({ key, windowStart })), expireAt: { $gt: at },
        }, { maxTimeMS, projection: { _id: 0, key: 1, windowStart: 1, count: 1 } }).limit(windows.length).toArray();
        return windows.map(({ label, metric, configuredLimit, key, windowStart, duration }) => {
          const value = rows.find((row) => row.key === key && row.windowStart === windowStart)?.count;
          return { label, metric, configuredLimit, count: Number.isFinite(value) ? value : null, startsAt: new Date(windowStart), endsAt: new Date(windowStart + duration) };
        });
      })),
      section(() => access.run("chat_locks", async (collection) => {
        const rows = await collection.find({ _id: { $in: keys.map((name) => "cool:" + name) }, expireAt: { $gt: at } },
          { maxTimeMS, projection: { _id: 1, expireAt: 1 } }).limit(keys.length).toArray();
        return keys.map((label) => {
          const until = rows.find((row) => row._id === "cool:" + label)?.expireAt;
          return { label, status: until ? "active" : "not_observed", until: until || null };
        });
      })),
      section(() => access.run("chat_cache", (collection) => collection.countDocuments({ expireAt: { $gt: at } }, { maxTimeMS }))),
    ]);
    return { database: db.status().chat, observedAt: at, corpusVersion: config.version, turnRetentionDays: 180, cacheRetentionHours: 24,
      configured: { providers: limits, generationStartsPer10s: 6 }, quota, cooldowns, cacheEntries };
  });
}

module.exports = { createOperations, currentWindows };
