const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const { createAdminRouter } = require("./routes/adminRoutes");
const { HttpError, asyncRoute, missing } = require("./utils/http");
const { createSecurityStore } = require("./auth/store");
const { createAuthService } = require("./auth/service");

function createApp({ config, db, store = createSecurityStore(db), now, chatNow, financialNow, log = (event) => console.log(JSON.stringify(event)) }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.proxyHops || false);
  app.set("query parser", "simple");
  app.use((req, res, next) => {
    const incoming = req.get("x-request-id");
    req.id = /^[A-Za-z0-9_.-]{1,64}$/.test(incoming || "") ? incoming : randomUUID();
    res.set({ "X-Request-Id": req.id, "Cache-Control": "no-store" });
    const start = Date.now();
    const timeout = setTimeout(() => {
      if (!res.headersSent) reply(req, res, 503, "REQUEST_TIMEOUT", "Request timed out");
    }, 12000);
    res.once("finish", () => log({ event: "request", requestId: req.id, method: req.method, status: res.statusCode, durationMs: Date.now() - start }));
    res.once("close", () => clearTimeout(timeout));
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.origins.includes(origin)) return callback(null, Boolean(origin));
      callback(new HttpError(403, "ORIGIN_DENIED", "Origin is not allowed"));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  }));
  app.use(express.json({ limit: "32kb" }));
  app.get("/", (req, res) => res.json({ message: "Admin API running", status: "ok" }));
  app.get("/ready", asyncRoute(async (req, res) => {
    await Promise.all([db.connect?.("primary"), db.connect?.("admin")]);
    const status = db.status();
    const ready = status.primary === "available" && status.admin === "available";
    if (!res.headersSent) res.status(ready ? 200 : 503).json({ ready });
  }));
  const security = createAuthService(config, store, { now, log });
  app.use("/api/admin", security.trustedProxy, createAdminRouter({ config, db, security, now: chatNow, financialNow }));
  app.use((req, res, next) => next(missing()));
  app.use((error, req, res, next) => {
    if (res.headersSent) return;
    if (error instanceof HttpError) return reply(req, res, error.status, error.code, error.message);
    if (["entity.parse.failed", "entity.too.large"].includes(error.type)) return reply(req, res, 400, "VALIDATION_ERROR", "Invalid request body");
    if (error instanceof URIError) return reply(req, res, 400, "VALIDATION_ERROR", "Invalid request path");
    log({ event: "internal_error", requestId: req.id });
    reply(req, res, 500, "INTERNAL_ERROR", "Unexpected server error");
  });
  return app;
}

function reply(req, res, status, code, message) {
  res.status(status).json({ success: false, error: { code, message }, message, requestId: req.id });
}

module.exports = { createApp };
