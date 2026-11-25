import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const allowedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const bodyLimit = 32 * 1024;
const cookieName = "__Secure-portfolio_admin=";

function error(res, requestId, status, code, message) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify({ success: false, error: { code, message }, requestId }));
}

export default async function adminProxy(req, res) {
  const candidate = req.headers["x-request-id"];
  const id = typeof candidate === "string" && /^[\w.-]{1,64}$/.test(candidate) ? candidate : randomUUID();
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Request-Id", id);
  const path = req.query?.__admin_path;
  if (typeof path !== "string" || path.length > 180 || !/^[a-z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) {
    return error(res, id, 404, "NOT_FOUND", "Resource not found");
  }
  if (!allowedMethods.has(req.method)) return error(res, id, 405, "METHOD_NOT_ALLOWED", "Method is not allowed");

  const secret = process.env.ADMIN_PROXY_SECRET;
  let upstream;
  try {
    upstream = new URL(process.env.ADMIN_API_UPSTREAM);
    if (upstream.protocol !== "https:" || upstream.href !== upstream.origin + "/" ||
        !/^[a-f0-9]{64}$/i.test(secret || "")) throw new Error();
  } catch {
    return error(res, id, 503, "API_UNAVAILABLE", "Administrator API is temporarily unavailable");
  }

  upstream.pathname = "/api/admin/" + path;
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "__admin_path") continue;
    for (const item of [].concat(value)) if (typeof item === "string") upstream.searchParams.append(key, item);
  }
  const headers = new Headers({ "x-admin-proxy-key": secret, "x-request-id": id, accept: "application/json" });
  const ip = req.headers["x-vercel-forwarded-for"];
  if (typeof ip === "string" && isIP(ip)) headers.set("x-admin-client-ip", ip);
  for (const name of ["origin", "sec-fetch-site", "x-admin-csrf"]) {
    const value = req.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }
  const cookies = (req.headers.cookie || "").split(";").map((cookie) => cookie.trim()).filter((cookie) => cookie.startsWith(cookieName));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  let body;
  if (!["HEAD", "GET"].includes(req.method)) {
    let incoming;
    try {
      incoming = req.body;
    } catch {
      return error(res, id, 400, "VALIDATION_ERROR", "Invalid request body");
    }
    if (incoming != null && incoming !== "" && !(Buffer.isBuffer(incoming) && incoming.length === 0)) {
      const type = req.headers["content-type"];
      if (typeof type !== "string" || !/^application\/json(?:\s*;|$)/i.test(type)) {
        return error(res, id, 415, "UNSUPPORTED_TYPE", "JSON is required");
      }
      headers.set("content-type", "application/json");
      body = typeof incoming === "string" || Buffer.isBuffer(incoming) ? incoming : JSON.stringify(incoming);
      if (Buffer.byteLength(body) > bodyLimit) return error(res, id, 413, "BODY_TOO_LARGE", "Request is too large");
    }
  }

  try {
    const response = await fetch(upstream, { method: req.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(14_000) });
    if (response.status >= 300 && response.status < 400) throw new Error();
    if (response.body && !response.headers.get("content-type")?.startsWith("application/json")) throw new Error();
    const setCookies = response.headers.getSetCookie().filter((cookie) => cookie.startsWith(cookieName));
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    for (const name of ["content-type", "retry-after", "x-content-type-options"]) {
      const value = response.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.statusCode = response.status;
    if (response.body) await pipeline(Readable.fromWeb(response.body), res);
    else res.end();
  } catch {
    if (!res.headersSent && !res.destroyed) error(res, id, 503, "API_UNAVAILABLE", "Administrator API is temporarily unavailable");
    else if (!res.destroyed) res.destroy();
  }
}
