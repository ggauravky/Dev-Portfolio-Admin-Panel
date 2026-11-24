const { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require("node:crypto");
const { isIP } = require("node:net");
const { HttpError, invalid } = require("../utils/http");
const { validPassword, verifyPassword } = require("./password");

const authenticated = () => new HttpError(401, "UNAUTHENTICATED", "Authentication required");
const forbidden = () => new HttpError(403, "CSRF_DENIED", "Request origin or verification is invalid");
const minute = 60_000;
const windowMs = 5 * minute;
const hash = (value) => createHash("sha256").update(value).digest();
const equal = (a, b) => typeof a === "string" && typeof b === "string" && timingSafeEqual(hash(a), hash(b));
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionId = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

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

function createAuthService(config, store, { now = Date.now, verify = verifyPassword, log = () => {} } = {}) {
  const owner = config.email;
  const secret = config.passwordHash;
  const secure = config.mode === "production";
  const cookieName = secure ? "__Secure-portfolio_admin" : "portfolio_admin";
  const cookieOptions = { httpOnly: true, secure, sameSite: "strict", path: "/api/admin" };
  const sign = (purpose, value) => createHmac("sha256", secret).update(purpose + "\0" + value).digest("base64url");
  let working = 0;
  const credentialVersion = secret && sign("credential-version", owner);
  const deadline = (at, duration) => new Date(+at + duration);
  const rejectedEvents = new Map();

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

  async function audit(req, type, result, { actor, target, category, id = randomUUID() } = {}) {
    const at = new Date(now());
    await store.audit({ _id: id, type, result, requestId: req.id, createdAt: at, expiresAt: deadline(at, config.auditDays * 86400000),
      ...(actor ? { actor } : {}), ...(target ? { target } : {}), ...(category ? { category } : {}) });
  }

  async function sampledAudit(req, event, id, options) {
    const bucket = Math.floor(now() / windowMs);
    if (rejectedEvents.get(event) === bucket) return;
    rejectedEvents.set(event, bucket);
    await audit(req, event, "denied", { ...options, id: id + ":" + bucket }).catch(() =>
      log({ event: "security_audit_unavailable", requestId: req.id, operation: event }));
  }

  async function rateLimit(req, res) {
    const at = now();
    const bucket = Math.floor(at / windowMs);
    const end = (bucket + 1) * windowMs;
    const expiresAt = new Date(end + windowMs);
    const ip = secure ? req.get("x-admin-client-ip") : req.socket.remoteAddress;
    const group = sign("network", networkGroup(ip));
    const limits = [["global", 60], ["network:" + group, 8], ["owner", 20]];
    for (const [key, max] of limits) {
      if (await store.reserve(key + ":" + bucket, max, expiresAt)) continue;
      await sampledAudit(req, "login_rate_limited", "rate-rejected");
      res.set("Retry-After", String(Math.max(1, Math.ceil((end - now()) / 1000))));
      throw new HttpError(429, "LOGIN_RATE_LIMITED", "Too many attempts. Try again later.");
    }
  }

  function publicSession(session, token) {
    return {
      administrator: { email: owner },
      session: { id: session._id, idleExpiresAt: session.idleExpiresAt, expiresAt: session.expiresAt },
      csrfToken: sign("csrf", token),
    };
  }

  async function find(req) {
    const token = cookie(req);
    if (!token) return null;
    const session = await store.lookup(sign("session", token));
    if (!session || session.owner !== owner || session.credentialVersion !== credentialVersion || session.revokedAt) return null;
    const at = new Date(now());
    if (session.idleExpiresAt <= at || session.expiresAt <= at) {
      await audit(req, "session_expired", "denied", { actor: owner, target: session._id, id: "expired:" + session._id }).catch(() =>
        log({ event: "security_audit_unavailable", requestId: req.id, operation: "session_expired" }));
      return null;
    }
    return { token, session };
  }

  async function authenticate(req) {
    let current = await find(req);
    if (!current) throw authenticated();
    const at = new Date(now());
    if (+at - +current.session.lastActivityAt >= minute) {
      const idle = new Date(Math.min(+current.session.expiresAt, +at + config.idleMinutes * minute));
      if (await store.touch(current.session._id, current.session.lastActivityAt, at, idle)) {
        current.session = { ...current.session, lastActivityAt: at, idleExpiresAt: idle };
      } else {
        current = await find(req);
        if (!current) throw authenticated();
      }
    }
    req.admin = current;
  }

  function verifyMutation(req, current) {
    origin(req);
    if (!equal(req.get("x-admin-csrf"), sign("csrf", current.token))) throw forbidden();
  }

  async function login(req, res) {
    origin(req);
    if (!req.is("application/json")) throw invalid("JSON credentials are required");
    const { email, password } = req.body || {};
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email.trim()) || !validPassword(password)) throw invalid("Invalid email or password format");
    await rateLimit(req, res);
    if (working >= 2) {
      res.set("Retry-After", "2");
      throw new HttpError(429, "LOGIN_BUSY", "Too many attempts. Try again later.");
    }
    let valid;
    working++;
    try { valid = await verify(secret, password); } finally { working--; }
    if (!valid || !equal(email.trim().toLowerCase(), owner)) {
      await audit(req, "login_failed", "denied");
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
    }
    if (res.headersSent) return;
    const previous = await find(req);
    const createdAt = new Date(now());
    const expiresAt = deadline(createdAt, config.maxHours * 60 * minute);
    const token = randomBytes(32).toString("base64url");
    const session = {
      _id: randomUUID(), tokenHash: sign("session", token), owner, credentialVersion, createdAt,
      lastActivityAt: createdAt, idleExpiresAt: new Date(Math.min(+expiresAt, +createdAt + config.idleMinutes * minute)),
      expiresAt, revokedAt: null,
    };
    await store.create(session);
    try {
      if (previous) await store.revoke(owner, credentialVersion, { _id: previous.session._id }, createdAt);
      await audit(req, "credential_version_observed", "allowed", { actor: owner, id: "credential:" + sign("audit-credential", owner) });
      await audit(req, "login_succeeded", "allowed", { actor: owner, target: session._id });
    } catch (error) {
      await store.revoke(owner, credentialVersion, { _id: session._id }, createdAt).catch(() => {});
      throw error;
    }
    if (res.headersSent) return;
    res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt });
    return publicSession(session, token);
  }

  async function revoke(req, selector, event, target) {
    // Audit before mutation. Failure leaves the session unchanged and visible.
    await audit(req, event, "requested", { actor: owner, target });
    const result = await store.revoke(owner, credentialVersion, selector, new Date(now()));
    await audit(req, event, "completed", { actor: owner, target }).catch(() =>
      log({ event: "security_audit_unavailable", requestId: req.id, operation: event }));
    return result.modifiedCount;
  }

  return {
    authenticate, trustedProxy, verifyMutation,
    authorizationDenied: (req) => sampledAudit(req, "authorization_denied", "authorization-denied", { actor: owner, category: "shared_write" }),
    login,
    me(req) { return publicSession(req.admin.session, req.admin.token); },
    async logout(req, res) {
      origin(req);
      const current = await find(req);
      if (current) {
        verifyMutation(req, current);
        await revoke(req, { _id: current.session._id }, "logout", current.session._id);
      }
      if (!res.headersSent) res.clearCookie(cookieName, cookieOptions);
    },
    async list(req) {
      const rows = await store.list(owner, credentialVersion, new Date(now()));
      return rows.map((row) => ({ id: row._id, current: row._id === req.admin.session._id, createdAt: row.createdAt,
        lastActivityAt: row.lastActivityAt, idleExpiresAt: row.idleExpiresAt, expiresAt: row.expiresAt }));
    },
    async revokeSessions(req, res, scope) {
      verifyMutation(req, req.admin);
      const id = req.params.id;
      if (scope === "one" && !sessionId.test(id || "")) throw invalid("Invalid session ID");
      const selector = scope === "one" ? { _id: id } : scope === "others" ? { _id: { $ne: req.admin.session._id } } : {};
      const count = await revoke(req, selector, "session_revocation", scope === "one" ? id : scope);
      if ((scope === "all" || id === req.admin.session._id) && !res.headersSent) res.clearCookie(cookieName, cookieOptions);
      return { revoked: count };
    },
  };
}

module.exports = { createAuthService, networkGroup };
