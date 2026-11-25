const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { isIP } = require("node:net");
const { HttpError, invalid } = require("../utils/http");
const { hashPassword, validPassword, verifyPassword } = require("./password");

// Stateless administrator sessions for a single owner.
// A session is an HMAC-SHA256 signed, short-lived cookie: nothing is written to MongoDB.
// Rotating ADMIN_SESSION_SECRET/JWT_SECRET or the administrator password invalidates every session.
// Limits: logout clears the browser cookie but cannot revoke a copied token before it expires, and
// the login rate limit is process-local (it resets on restart and is not shared between instances).

const authenticated = () => new HttpError(401, "UNAUTHENTICATED", "Authentication required");
const forbidden = () => new HttpError(403, "CSRF_DENIED", "Request origin or verification is invalid");
const minute = 60_000;
const windowMs = 5 * minute;
const tokenPattern = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;
const digest = (key, value) => createHmac("sha256", key).update(value).digest();
const equal = (a, b) => typeof a === "string" && typeof b === "string" &&
  timingSafeEqual(digest("compare", a), digest("compare", b));

function networkGroup(input) {
  const ip = (input || "").replace(/^::ffff:(?=\d)/i, "");
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes("%")) return "unknown";
  const normalized = new URL("http://[" + ip + "]").hostname.slice(1, -1);
  if (normalized.startsWith("::ffff:")) {
    return normalized.slice(7).split(":").flatMap((part) => {
      const value = parseInt(part, 16);
      return [value >>> 8, value & 255];
    }).join(".");
  }
  const [left, right] = normalized.split("::");
  const parts = left ? left.split(":") : [];
  if (right !== undefined) {
    const tail = right ? right.split(":") : [];
    parts.push(...Array(8 - parts.length - tail.length).fill("0"), ...tail);
  }
  return parts.slice(0, 4).join(":") + "/64";
}

function createRateLimiter(now, limits) {
  const counters = new Map();
  return function reserve(keys) {
    const bucket = Math.floor(now() / windowMs);
    if (counters.size > 5000) {
      for (const [key, entry] of counters) if (entry.bucket !== bucket) counters.delete(key);
    }
    const entries = keys.map((key) => {
      const current = counters.get(key);
      return [key, current?.bucket === bucket ? current : { bucket, count: 0 }];
    });
    if (entries.some(([key, entry]) => entry.count >= limits[key.split(":")[0]])) return { allowed: false, resetAt: (bucket + 1) * windowMs };
    for (const [key, entry] of entries) {
      entry.count++;
      counters.set(key, entry);
    }
    return { allowed: true };
  };
}

function createAuthService(config, { now = Date.now, verify = verifyPassword, hash = hashPassword, log = () => {} } = {}) {
  const owner = config.email;
  const secure = config.mode === "production";
  const cookieName = secure ? "__Secure-portfolio_admin" : "portfolio_admin";
  const cookieOptions = { httpOnly: true, secure, sameSite: "strict", path: "/api/admin" };
  const signingKey = digest(config.sessionSecret, "portfolio-admin-session-v2");
  const sign = (purpose, value) => createHmac("sha256", signingKey).update(purpose + "\0" + value).digest("base64url");
  // Binds sessions to the current credential: a new password invalidates existing cookies.
  const credentialVersion = sign("credential", owner + "\0" + (config.passwordHash || config.password)).slice(0, 22);
  const lifetime = config.maxHours * 60 * minute;
  const reserve = createRateLimiter(now, { global: 60, network: 8, owner: 20 });
  let storedHash = config.passwordHash ? Promise.resolve(config.passwordHash) : null;
  let working = 0;

  // Without ADMIN_PASSWORD_HASH, the legacy ADMIN_PASSWORD is hashed once in memory with Argon2id.
  const passwordHash = () => {
    if (!storedHash) storedHash = hash(config.password).catch((error) => { storedHash = null; throw error; });
    return storedHash;
  };

  function event(req, type, result) {
    log({ event: "security", type, result, requestId: req.id });
  }

  function trustedProxy(req, res, next) {
    if (secure && !equal(req.get("x-admin-proxy-key"), config.proxySecret)) {
      return next(new HttpError(403, "PROXY_REQUIRED", "Use the administrator portal"));
    }
    next();
  }

  function origin(req) {
    if (!config.origins.includes(req.get("origin")) || ["cross-site", "same-site"].includes(req.get("sec-fetch-site"))) throw forbidden();
  }

  function cookie(req) {
    const values = (req.get("cookie") || "").split(";").map((item) => item.trim())
      .filter((item) => item.startsWith(cookieName + "=")).map((item) => item.slice(cookieName.length + 1));
    return values.length === 1 && tokenPattern.test(values[0]) ? values[0] : null;
  }

  function issue() {
    const issuedAt = now();
    const claims = { sub: owner, v: credentialVersion, iat: issuedAt, exp: issuedAt + lifetime, n: randomBytes(9).toString("base64url") };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return { token: payload + "." + sign("session", payload), claims };
  }

  function read(req) {
    const token = cookie(req);
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!equal(signature, sign("session", payload))) return null;
    let claims;
    try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
    if (!claims || claims.sub !== owner || claims.v !== credentialVersion || !Number.isSafeInteger(claims.exp) ||
        !Number.isSafeInteger(claims.iat) || claims.exp - claims.iat > lifetime || claims.exp <= now() || claims.iat > now() + minute) return null;
    return { token, claims };
  }

  function publicSession({ token, claims }) {
    return {
      administrator: { email: owner },
      session: { issuedAt: new Date(claims.iat), expiresAt: new Date(claims.exp), storage: "signed-cookie" },
      csrfToken: sign("csrf", token),
    };
  }

  async function authenticate(req) {
    const current = read(req);
    if (!current) throw authenticated();
    req.admin = current;
  }

  function verifyMutation(req, current) {
    origin(req);
    if (!equal(req.get("x-admin-csrf"), sign("csrf", current.token))) throw forbidden();
  }

  function rateLimit(req, res) {
    const ip = secure ? req.get("x-admin-client-ip") : req.socket.remoteAddress;
    const result = reserve(["global", "network:" + sign("network", networkGroup(ip)), "owner"]);
    if (result.allowed) return;
    event(req, "login_rate_limited", "denied");
    res.set("Retry-After", String(Math.max(1, Math.ceil((result.resetAt - now()) / 1000))));
    throw new HttpError(429, "LOGIN_RATE_LIMITED", "Too many attempts. Try again later.");
  }

  async function login(req, res) {
    origin(req);
    if (!req.is("application/json")) throw invalid("JSON credentials are required");
    const { email, password } = req.body || {};
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email.trim()) || !validPassword(password)) throw invalid("Invalid email or password format");
    rateLimit(req, res);
    if (working >= 2) {
      res.set("Retry-After", "2");
      throw new HttpError(429, "LOGIN_BUSY", "Too many attempts. Try again later.");
    }
    let valid;
    working++;
    try { valid = await verify(await passwordHash(), password); } finally { working--; }
    if (!valid || !equal(email.trim().toLowerCase(), owner)) {
      event(req, "login_failed", "denied");
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
    }
    if (res.headersSent) return;
    const session = issue();
    event(req, "login_succeeded", "allowed");
    res.cookie(cookieName, session.token, { ...cookieOptions, expires: new Date(session.claims.exp) });
    return publicSession(session);
  }

  return {
    authenticate, trustedProxy, verifyMutation,
    authorizationDenied: async (req) => event(req, "authorization_denied", "denied"),
    login,
    me: (req) => publicSession(req.admin),
    async logout(req, res) {
      origin(req);
      const current = read(req);
      if (current) verifyMutation(req, current);
      event(req, "logout", "allowed");
      if (!res.headersSent) res.clearCookie(cookieName, cookieOptions);
    },
  };
}

module.exports = { createAuthService, networkGroup };
