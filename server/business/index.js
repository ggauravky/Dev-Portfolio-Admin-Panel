const { createRegistry, specs, id, portfolioRevision } = require("./registry");
const { collectionRead, maxTimeMS } = require("../repositories/reads");
const { createBusinessAnalytics } = require("./analytics");
const { createAudit } = require("./audit");
const { HttpError, asyncRoute, send } = require("../utils/http");
const { only } = require("../chat/query");
const { collections } = require("../auth/store");
const { chatRetention } = require("../chat/operations");

function business(router, { db, auth, security, now }) {
  const registry = createRegistry(db, now);
  const analytics = createBusinessAnalytics(registry, now);
  const audit = createAudit(db, now);
  const resources = Object.entries(specs).filter(([, spec]) => spec.alias);
  const paths = [...resources.map(([path]) => path), "business-analytics", "audit-events"];
  for (const path of paths) {
    router.use("/" + path, (req, res, next) => {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
      auth(req, res, (error) => {
        if (error) return next(error);
        void security.authorizationDenied(req).then(() => next(new HttpError(403, "OPERATION_DISABLED", "This operation is disabled")), next);
      });
    });
  }
  for (const [path, spec] of resources) {
    router.get("/" + path, auth, asyncRoute(async (req, res) => {
      const data = await registry.list(path, req.query);
      if (!res.headersSent) res.json({ success: true, data, [spec.alias]: data.items, total: data.total });
    }));
    router.get("/" + path + "/:id", auth, asyncRoute(async (req, res) => {
      const data = await registry.detail(path, req.params.id, req.query);
      if (!res.headersSent) res.json(data);
    }));
  }
  for (const path of ["activity", "transactions", "bookings", "blog-supports"]) {
    router.get("/users/:id/" + path, auth, asyncRoute(async (req, res) => {
      const userId = id(req.params.id);
      await registry.detail("users", req.params.id, {});
      send(res, await registry.list(path, req.query, { userId, ...(path === "transactions" ? { provider: "razorpay" } : {}) }));
    }));
  }
  router.get("/business-analytics", auth, asyncRoute(async (req, res) => send(res, await analytics(req.query))));
  router.get("/audit-events", auth, asyncRoute(async (req, res) => send(res, await audit.list(req.query))));
  router.get("/audit-events/:id", auth, asyncRoute(async (req, res) => send(res, await audit.detail(req.params.id, req.query))));
  return { analytics, capabilities: Object.fromEntries(paths.map((path) => [path, { read: true, write: false }])) };
}

async function systemStatus(db, config, capabilities, query) {
  only(query, []);
  await Promise.all([db.connect?.("primary"), db.connect?.("chat"), db.connect?.("admin")]);
  const dependencies = db.status();
  const targets = { activityevents: ["primary", "activityevents"], supports: ["primary", "supports"], blogposts: ["primary", "blogposts"],
    supportpayments: ["primary", "supportpayments"], audit: ["admin", collections.audit] };
  const optionalCollections = Object.fromEntries(await Promise.all(Object.entries(targets).map(async ([key, [dependency, name]]) => {
    if (dependencies[dependency] !== "available") return [key, dependencies[dependency] || "unknown"];
    if (!db.hasCollection?.(dependency, name)) return [key, "unknown"];
    try {
      await collectionRead(db, name, dependency)((c) => c.findOne({}, { projection: { _id: 1 }, maxTimeMS }));
      return [key, "available"];
    } catch (error) { return [key, error.code === "READ_PERMISSION" ? "insufficient_permission" : "unavailable"]; }
  })));
  return { dependencies, configuration: "valid", ready: dependencies.primary === "available" && dependencies.admin === "available", readOnly: true,
    globalReadOnly: config.readOnly, capabilities, checkedAt: new Date(), process: "available",
    optionalCollections,
    policy: { timezone: "Asia/Kolkata", idleMinutes: config.idleMinutes, maxHours: config.maxHours, auditDays: config.auditDays, chatRetention,
      portfolioRevision, contractRevision: require("../contracts/portfolio-schema.json").revision, version: require("../package.json").version } };
}

module.exports = { business, systemStatus };
