const { mongo: { MongoClient } } = require("mongoose");
const { isIP } = require("node:net");
const { validHash } = require("../auth/password");

function fail(key) {
  throw new Error("Invalid or missing configuration: " + key);
}

function database(uri, explicitName, key) {
  if (!uri) fail(key);
  let named;
  try {
    // Validate standard and SRV strings with the installed driver, without connecting.
    new MongoClient(uri);
    const path = uri.match(/^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/i)?.[1];
    named = path ? decodeURIComponent(path) : "";
  } catch {
    fail(key);
  }
  const name = explicitName || named;
  if (!name || !/^[A-Za-z0-9_-]{1,63}$/.test(name) || /^(admin|local|config|test)$/i.test(name)) fail(key + " database identity");
  if (named && named !== name) fail(key + " database identity mismatch");
  return { uri, name };
}

function integer(value, fallback, min, max, key) {
  const input = value ?? String(fallback);
  if (!/^\d+$/.test(input) || Number(input) < min || Number(input) > max) fail(key);
  return Number(input);
}

function readDatabaseConfig(env = process.env) {
  if (env.PORTFOLIO_MONGODB_URI && env.MONGO_URI && env.PORTFOLIO_MONGODB_URI !== env.MONGO_URI) fail("PORTFOLIO_MONGODB_URI and MONGO_URI conflict");
  if (env.PORTFOLIO_MONGODB_URI && !env.PORTFOLIO_DB_NAME) fail("PORTFOLIO_DB_NAME");
  const primary = database(env.PORTFOLIO_MONGODB_URI || env.MONGO_URI, env.PORTFOLIO_DB_NAME, "primary MongoDB");
  const chat = env.CHAT_MONGODB_URI ? database(env.CHAT_MONGODB_URI, "portfolio_chat", "CHAT_MONGODB_URI") : null;
  if (primary.name === "portfolio_chat") fail("primary MongoDB database identity");
  const dnsServers = env.DNS_SERVERS ? env.DNS_SERVERS.split(",").map((value) => value.trim()) : [];
  if (dnsServers.some((value) => !isIP(value))) fail("DNS_SERVERS");
  return {
    primary, chat, dnsServers,
    connectTimeout: integer(env.DB_CONNECT_TIMEOUT_MS, 5000, 500, 15000, "DB_CONNECT_TIMEOUT_MS"),
    poolSize: integer(env.DB_POOL_SIZE, 8, 1, 30, "DB_POOL_SIZE"),
  };
}

function readConfig(env = process.env) {
  const mode = env.NODE_ENV || "development";
  if (!["production", "development", "test"].includes(mode)) fail("NODE_ENV");
  const origins = [...new Set([env.FRONTEND_URL, ...(env.ADMIN_ALLOWED_ORIGINS || "").split(",")]
    .map((value) => value?.trim()).filter(Boolean))];
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (mode === "production" && url.protocol !== "https:")) fail("ADMIN_ALLOWED_ORIGINS");
    } catch {
      fail("ADMIN_ALLOWED_ORIGINS");
    }
  }
  if (mode === "production" && !origins.length) fail("ADMIN_ALLOWED_ORIGINS or FRONTEND_URL");
  if (mode !== "production") origins.push(...[3000, 5173, 5174].map((port) => "http://localhost:" + port));
  if (env.READ_ONLY_MODE !== undefined && !["true", "false"].includes(env.READ_ONLY_MODE)) fail("READ_ONLY_MODE");
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) fail("ADMIN_EMAIL");
  if (!validHash(env.ADMIN_PASSWORD_HASH)) fail("ADMIN_PASSWORD_HASH");
  if (!env.ADMIN_DB_NAME) fail("ADMIN_DB_NAME");
  const databases = readDatabaseConfig(env);
  const admin = database(env.ADMIN_MONGODB_URI, env.ADMIN_DB_NAME, "ADMIN_MONGODB_URI");
  if ([databases.primary.name, "portfolio_chat"].includes(admin.name)) fail("ADMIN_DB_NAME must be dedicated");
  if (mode === "production" && !/^[a-f0-9]{64}$/i.test(env.ADMIN_PROXY_SECRET || "")) fail("ADMIN_PROXY_SECRET");

  return {
    ...databases,
    mode, origins, admin,
    readOnly: env.READ_ONLY_MODE === "true",
    port: integer(env.PORT, 5000, 1, 65535, "PORT"),
    proxyHops: integer(env.TRUST_PROXY_HOPS, 0, 0, 2, "TRUST_PROXY_HOPS"),
    email,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    proxySecret: env.ADMIN_PROXY_SECRET,
    idleMinutes: integer(env.ADMIN_SESSION_IDLE_MINUTES, 30, 5, 120, "ADMIN_SESSION_IDLE_MINUTES"),
    maxHours: integer(env.ADMIN_SESSION_MAX_HOURS, 12, 1, 24, "ADMIN_SESSION_MAX_HOURS"),
    auditDays: integer(env.ADMIN_AUDIT_RETENTION_DAYS, 90, 7, 365, "ADMIN_AUDIT_RETENTION_DAYS"),
  };
}

module.exports = { readConfig, readDatabaseConfig };
