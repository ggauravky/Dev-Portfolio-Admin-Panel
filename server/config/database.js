const { mongo: { MongoClient } } = require("mongoose");
const { collections: securityCollections, verifySecurityIndexes } = require("../auth/store");

const primaryAnchors = ["contacts", "newsletters", "bookings", "paymenttransactions", "users", "blogposts"];
const anchors = { primary: primaryAnchors, chat: ["chat_turns"], admin: Object.values(securityCollections) };
const cooldown = 30_000;

function createDatabases(config, { Client = MongoClient, log = () => {}, now = Date.now } = {}) {
  let closing = false;
  const slots = Object.fromEntries(["primary", "chat", ...(config.admin ? ["admin"] : [])].map((key) => [key, {
    target: config[key], client: null, database: null, collections: new Set(), pending: null, retryAt: 0, verifiedAt: 0,
  }]));

  async function connect(key) {
    const slot = slots[key];
    if (closing || !slot?.target || now() < slot.retryAt) return;
    if (slot.pending) return slot.pending;
    if (slot.database && now() - slot.verifiedAt < cooldown) return;

    slot.pending = (async () => {
      try {
        if (!slot.client) {
          slot.client = new Client(slot.target.uri, {
            serverSelectionTimeoutMS: config.connectTimeout,
            connectTimeoutMS: config.connectTimeout,
            waitQueueTimeoutMS: config.connectTimeout,
            socketTimeoutMS: config.connectTimeout + 3000,
            maxPoolSize: config.poolSize,
            appName: "portfolio-admin",
            ...(key === "admin" ? {
              readPreference: "primary",
              readConcern: { level: "majority" },
              writeConcern: { w: "majority", wtimeoutMS: config.connectTimeout },
            } : {}),
          });
          await slot.client.connect();
        }
        const database = slot.client.db(slot.target.name);
        const present = await database.listCollections(
          {},
          { nameOnly: true, authorizedCollections: true, maxTimeMS: 2000 },
        ).toArray();
        const collections = new Set(present.map(({ name }) => name));
        if (!anchors[key].some((name) => collections.has(name)) || database.databaseName !== slot.target.name) throw new Error("identity unverified");
        if (key === "admin") await verifySecurityIndexes(database);
        if (!slot.database) log({ event: "database_available", dependency: key });
        slot.database = database;
        slot.collections = collections;
        slot.verifiedAt = now();
      } catch {
        slot.database = null;
        slot.retryAt = now() + cooldown;
        log({ event: "database_unavailable", dependency: key });
        await slot.client?.close().catch(() => {});
        slot.client = null;
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
    hasCollection: (key, name) => Boolean(slots[key].database && slots[key].collections.has(name)),
    invalidate,
    status: () => Object.fromEntries(Object.entries(slots).map(([key, slot]) => [
      key, !slot.target ? "not_configured" : slot.database ? "available" : "unavailable",
    ])),
    async close() {
      closing = true;
      await Promise.allSettled(Object.values(slots).map(async (slot) => {
        await slot.pending;
        slot.database = null;
        await slot.client?.close();
      }));
    },
  };
}

module.exports = { createDatabases, primaryAnchors };
