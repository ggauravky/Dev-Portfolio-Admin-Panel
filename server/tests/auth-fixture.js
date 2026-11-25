const { once } = require("node:events");
const { hashPassword } = require("../auth/password");
const { readConfig } = require("../config/env");

const password = " isolated fixture password ";
const email = "owner@example.test";
const origin = "https://owner.example.test";
const proxySecret = "a".repeat(64);
let credential;

const sessionSecret = "isolated-fixture-session-secret-0123456789";

async function fixtureEnv(extra = {}) {
  credential ??= hashPassword(password);
  return {
    MONGO_URI: "mongodb://localhost/fixture",
    PORTFOLIO_DB_NAME: "fixture",
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: await credential,
    ADMIN_SESSION_SECRET: sessionSecret,
    FRONTEND_URL: origin,
    ...extra,
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

module.exports = { fixtureEnv, fixtureConfig, sessionSecret, http, login, email, password, origin, proxySecret };
