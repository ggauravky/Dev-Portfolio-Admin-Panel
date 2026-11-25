const { mongo: { MongoClient } } = require("mongoose");

const primaryAnchors = ["contacts", "newsletters", "bookings", "paymenttransactions", "users", "blogposts"];
const anchors = { primary: primaryAnchors, chat: ["chat_turns"] };
const cooldown = 30_000;

// Read-only access to the existing Portfolio databases. When the chat database is reached with
// the same connection string as the primary one, both slots share a single MongoClient and pool.
function createDatabases(config, { Client = MongoClient, log = () => {}, now = Date.now } = {}) {
  let closing = false;
  const clients = new Map();
  const slots = Object.fromEntries(["primary", "chat"].map((key) => [key, {
    target: config[key], database: null, collections: new Set(), pending: null, retryAt: 0, verifiedAt: 0,
  }]));

  async function client(uri) {
    let entry = clients.get(uri);
    if (!entry) {
      const instance = new Client(uri, {
        serverSelectionTimeoutMS: config.connectTimeout,
        connectTimeoutMS: config.connectTimeout,
        waitQueueTimeoutMS: config.connectTimeout,
        socketTimeoutMS: config.connectTimeout + 3000,
        maxPoolSize: config.poolSize,
        readPreference: "primaryPreferred",
        appName: "portfolio-admin",
      });
      entry = { instance, ready: instance.connect().then(() => instance) };
      clients.set(uri, entry);
    }
    try {
      return await entry.ready;
    } catch (error) {
      if (clients.get(uri) === entry) clients.delete(uri);
      await entry.instance.close().catch(() => {});
      throw error;
    }
  }

  async function dropClient(uri) {
    const entry = clients.get(uri);
    if (!entry) return;
    clients.delete(uri);
    for (const slot of Object.values(slots)) {
      if (slot.target?.uri === uri) { slot.database = null; slot.verifiedAt = 0; }
    }
    await entry.instance.close().catch(() => {});
  }

  async function connect(key) {
    const slot = slots[key];
    if (closing || !slot?.target || now() < slot.retryAt) return;
    if (slot.pending) return slot.pending;
    if (slot.database && now() - slot.verifiedAt < cooldown) return;

    slot.pending = (async () => {
      try {
        const database = (await client(slot.target.uri)).db(slot.target.name);
        const present = await database.listCollections(
          {},
          { nameOnly: true, authorizedCollections: true, maxTimeMS: 2000 },
        ).toArray();
        const collections = new Set(present.map(({ name }) => name));
        if (!anchors[key].some((name) => collections.has(name)) || database.databaseName !== slot.target.name) throw new Error("identity unverified");
        if (!slot.database) log({ event: "database_available", dependency: key });
        slot.database = database;
        slot.collections = collections;
        slot.verifiedAt = now();
      } catch (error) {
        slot.database = null;
        slot.retryAt = now() + cooldown;
        log({ event: "database_unavailable", dependency: key });
        if (error.message !== "identity unverified") await dropClient(slot.target.uri);
      }
    })();
    try {
      await slot.pending;
    } finally {
      slot.pending = null;
    }
  }

  function invalidate(key) {
    slots[key].database = null;
    slots[key].verifiedAt = 0;
  }

  return {
    connect,
    get: (key) => slots[key]?.database,
    hasCollection: (key, name) => Boolean(slots[key]?.database && slots[key].collections.has(name)),
    invalidate,
    shared: () => Boolean(config.primary && config.chat && config.primary.uri === config.chat.uri),
    status: () => Object.fromEntries(Object.entries(slots).map(([key, slot]) => [
      key, !slot.target ? "not_configured" : slot.database ? "available" : "unavailable",
    ])),
    async close() {
      closing = true;
      await Promise.allSettled(Object.values(slots).map((slot) => slot.pending));
      for (const slot of Object.values(slots)) slot.database = null;
      await Promise.allSettled([...clients.values()].map((entry) => entry.instance.close()));
      clients.clear();
    },
  };
}

module.exports = { createDatabases, primaryAnchors };
