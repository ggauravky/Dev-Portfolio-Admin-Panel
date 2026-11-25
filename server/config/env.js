const { mongo: { MongoClient } } = require("mongoose");
const { isIP } = require("node:net");
const { validHash, validPassword } = require("../auth/password");

function fail(key) {
  throw new Error("Invalid or missing configuration: " + key);
}

function database(uri, explicitName, key, fallbackName, strict = true) {
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
  const name = explicitName || named || fallbackName;
  if (!name || !/^[A-Za-z0-9_-]{1,63}$/.test(name) || /^(admin|local|config)$/i.test(name)) fail(key + " database identity");
  if (strict && named && named !== name) fail(key + " database identity mismatch");
  return { uri, name };
}

function integer(value, fallback, min, max, key) {
  const input = value ?? String(fallback);
  if (!/^\d+$/.test(input) || Number(input) < min || Number(input) > max) fail(key);
  return Number(input);
}

function readDatabaseConfig(env = process.env) {
  if (env.PORTFOLIO_MONGODB_URI && env.MONGO_URI && env.PORTFOLIO_MONGODB_URI !== env.MONGO_URI) fail("PORTFOLIO_MONGODB_URI and MONGO_URI conflict");
  const uri = env.MONGO_URI || env.PORTFOLIO_MONGODB_URI;
  // The Portfolio stores business records in the existing database named "test".
  const primary = database(uri, env.PORTFOLIO_DB_NAME, "MONGO_URI", "test");
  if (primary.name.toLowerCase() === "portfolio_chat") fail("primary MongoDB database identity");
  // The Portfolio chatbot stores turns in "portfolio_chat" on the same cluster. Reuse the primary
  // connection unless a separate CHAT_MONGODB_URI credential is configured.
  const chat = { uri: env.CHAT_MONGODB_URI ? database(env.CHAT_MONGODB_URI, "portfolio_chat", "CHAT_MONGODB_URI", null, false).uri : uri, name: "portfolio_chat" };
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
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) fail("ADMIN_EMAIL");
  const passwordHash = env.ADMIN_PASSWORD_HASH || null;
  if (passwordHash && !validHash(passwordHash)) fail("ADMIN_PASSWORD_HASH");
  const password = passwordHash ? null : env.ADMIN_PASSWORD;
  if (!passwordHash && !validPassword(password)) fail("ADMIN_PASSWORD_HASH or ADMIN_PASSWORD");
  if (!passwordHash && mode === "production" && password.length < 12) fail("ADMIN_PASSWORD must be at least 12 characters");
  const sessionSecret = env.ADMIN_SESSION_SECRET || env.JWT_SECRET;
  if (typeof sessionSecret !== "string" || sessionSecret.length < 32 || Buffer.byteLength(sessionSecret) > 512) fail("ADMIN_SESSION_SECRET or JWT_SECRET (at least 32 characters)");
  const databases = readDatabaseConfig(env);
  if (mode === "production" && !/^[a-f0-9]{64}$/i.test(env.ADMIN_PROXY_SECRET || "")) fail("ADMIN_PROXY_SECRET");

  return {
    ...databases,
    mode, origins,
    port: integer(env.PORT, 5000, 1, 65535, "PORT"),
    proxyHops: integer(env.TRUST_PROXY_HOPS, 0, 0, 2, "TRUST_PROXY_HOPS"),
    email,
    passwordHash,
    password,
    sessionSecret,
    proxySecret: env.ADMIN_PROXY_SECRET,
    maxHours: integer(env.ADMIN_SESSION_MAX_HOURS, 8, 1, 24, "ADMIN_SESSION_MAX_HOURS"),
  };
}

module.exports = { readConfig, readDatabaseConfig };
