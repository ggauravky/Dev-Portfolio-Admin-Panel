const { once } = require("node:events");
const { hashPassword } = require("../auth/password");
const { readConfig } = require("../config/env");

const password = " isolated fixture password ";
const email = "owner@example.test";
const origin = "https://owner.example.test";
const proxySecret = "a".repeat(64);
let credential;

async function fixtureEnv(extra = {}) {
  credential ??= hashPassword(password);
  return {
    PORTFOLIO_MONGODB_URI: "mongodb://localhost/fixture",
    PORTFOLIO_DB_NAME: "fixture",
    ADMIN_MONGODB_URI: "mongodb://localhost/fixture_admin",
    ADMIN_DB_NAME: "fixture_admin",
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: await credential,
    FRONTEND_URL: origin,
    READ_ONLY_MODE: "true",
    ...extra,
  };
}

function fixtureStore() {
  const sessions = new Map();
  const counters = new Map();
  const audits = new Map();
  let available = true;
  function assertAvailable() {
    if (!available) throw require("../auth/store").authUnavailable();
  }
  return {
    sessions, counters, audits,
    setAvailable: (value) => { available = value; },
    async create(record) { assertAvailable(); sessions.set(record._id, { ...record }); },
    async lookup(tokenHash) {
      assertAvailable();
      const record = [...sessions.values()].find((item) => item.tokenHash === tokenHash);
      return record && { ...record };
    },
    async touch(id, old, now, expires) {
      assertAvailable();
      const record = sessions.get(id);
      if (!record || record.revokedAt || record.idleExpiresAt <= now || record.expiresAt <= now || +record.lastActivityAt !== +old) return false;
      Object.assign(record, { lastActivityAt: now, idleExpiresAt: expires });
      return true;
    },
    async list(owner, credentialVersion, now) {
      assertAvailable();
      return [...sessions.values()].filter((row) => row.owner === owner && row.credentialVersion === credentialVersion &&
        !row.revokedAt && row.idleExpiresAt > now && row.expiresAt > now);
    },
    async revoke(owner, credentialVersion, selector, now) {
      assertAvailable();
      let modifiedCount = 0;
      for (const row of sessions.values()) {
        if (row.owner !== owner || row.credentialVersion !== credentialVersion || row.revokedAt) continue;
        if (typeof selector._id === "string" && selector._id !== row._id || selector._id?.$ne === row._id) continue;
        row.revokedAt = now;
        modifiedCount++;
      }
      return { modifiedCount };
    },
    async reserve(key, limit) {
      assertAvailable();
      const count = counters.get(key) || 0;
      if (count >= limit) return false;
      counters.set(key, count + 1);
      return true;
    },
    async audit(event) { assertAvailable(); if (!audits.has(event._id)) audits.set(event._id, event); },
  };
}

async function http(t, app) {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  return (path, { method = "GET", json, cookie, csrf, headers } = {}) => fetch(base + "/api/admin" + path, {
    method,
    headers: {
      Origin: origin,
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-Admin-CSRF": csrf } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
  });
}

async function login(request, options = {}) {
  const { json = { email, password }, ...rest } = options;
  const response = await request("/login", { method: "POST", json, ...rest });
  const payload = await response.json();
  const setCookie = response.headers.get("set-cookie");
  return { response, payload, setCookie, cookie: setCookie?.split(";")[0], csrf: payload.data?.csrfToken };
}

const fixtureConfig = async (extra) => readConfig(await fixtureEnv(extra));

module.exports = { fixtureEnv, fixtureConfig, fixtureStore, http, login, email, password, origin, proxySecret };
