const express = require("express");
const jwt = require("jsonwebtoken");
const { timingSafeEqual, createHash } = require("node:crypto");
const { repository } = require("../repositories/reads");
const { HttpError, invalid, send, asyncRoute } = require("../utils/http");

const resources = {
  contacts: ["contacts", "contacts"], newsletters: ["newsletters", "newsletters"],
  bookings: ["bookings", "bookings"], chats: ["chat_turns", "chats"],
  "support-payments": ["paymenttransactions", "supportPayments", { flowType: "support" }],
  transactions: ["paymenttransactions", "transactions"],
  users: ["users", "users"], activity: ["activityevents", "activity"],
  "webhook-events": ["paymentwebhookevents", "events"], "blog-posts": ["blogposts", "posts"],
  "blog-supports": ["supports", "supports"],
};
const capabilities = Object.fromEntries(Object.keys(resources).map((path) => [path, { read: true, write: false }]));
const denied = () => new HttpError(403, "OPERATION_DISABLED", "This operation is disabled");
const unauthenticated = () => new HttpError(401, "UNAUTHENTICATED", "Authentication required");
const digest = (value) => createHash("sha256").update(value).digest();

function createAdminRouter({ config, db }) {
  const router = express.Router();
  const repositories = {};
  const auth = (req, res, next) => {
    try {
      const value = req.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
      if (!value) throw unauthenticated();
      const decoded = jwt.verify(value, config.jwtSecret, { algorithms: ["HS256"] });
      if (decoded.email !== config.email) throw unauthenticated();
      next();
    } catch {
      next(unauthenticated());
    }
  };
  router.post("/login", asyncRoute((req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) throw invalid("Email and password are required");
    const match = timingSafeEqual(digest(password.trim()), digest(config.password));
    if (email.trim().toLowerCase() !== config.email || !match) throw new HttpError(401, "UNAUTHENTICATED", "Invalid credentials");
    res.json({ token: jwt.sign({ email: config.email }, config.jwtSecret, { algorithm: "HS256", expiresIn: "7d" }), message: "Login successful" });
  }));

  for (const [path, [collection, legacy, fixed]] of Object.entries(resources)) {
    const read = repository(db, collection, fixed);
    repositories[path] = read;
    router.get("/" + path, auth, asyncRoute(async (req, res) => {
      const page = await read.list(req.query);
      if (!res.headersSent) res.json({ success: true, data: page, [legacy]: page.items, total: page.total });
    }));
    router.get("/" + path + "/:id", auth, asyncRoute(async (req, res) => {
      const record = await read.detail(req.params.id);
      if (!res.headersSent) res.json(record);
    }));
    for (const [method, suffix] of [["post", ""], ["post", "/bulk-delete"], ["put", "/:id"], ["patch", "/:id"], ["delete", "/:id"]]) {
      router[method]("/" + path + suffix, auth, (req, res, next) => next(denied()));
    }
  }
  router.get("/system", auth, asyncRoute(async (req, res) => {
    await Promise.all([db.connect?.("primary"), db.connect?.("chat")]);
    const dependencies = db.status();
    send(res, { dependencies, configuration: "valid", ready: dependencies.primary === "available", readOnly: true, globalReadOnly: config.readOnly, capabilities });
  }));
  router.get("/stats", auth, asyncRoute(async (req, res) => {
    const count = (path, filter) => repositories[path].count(filter);
    const chatAvailable = db.status().chat === "available";
    if (!chatAvailable) void db.connect?.("chat");
    const metrics = {
      totalContacts: count("contacts"), unreadContacts: count("contacts", { status: "unread" }),
      totalNewsletters: count("newsletters", { subscribed: { $ne: false } }),
      unsubscribedNewsletters: count("newsletters", { subscribed: false }),
      totalBookings: count("bookings"), paidBookings: count("bookings", { paymentStatus: "paid" }),
      createdBookings: count("bookings", { paymentStatus: "created" }),
      pendingBookings: count("bookings", { paymentStatus: "pending" }),
      failedBookings: count("bookings", { paymentStatus: "failed" }),
      totalSupportPayments: count("support-payments"), paidSupportPayments: count("support-payments", { status: "paid" }),
      pendingSupportPayments: count("support-payments", { status: "pending" }),
      totalChats: chatAvailable ? count("chats") : Promise.resolve(null),
    };
    const results = await Promise.allSettled(Object.values(metrics));
    if (results.slice(0, -1).every(({ status }) => status === "rejected")) {
      throw new HttpError(503, "DEPENDENCY_UNAVAILABLE", "Portfolio statistics are unavailable");
    }
    const values = Object.fromEntries(Object.keys(metrics).map((key, index) => [key, results[index].status === "fulfilled" ? results[index].value : null]));
    if (!res.headersSent) res.json({ ...values, availability: db.status(), generatedAt: new Date().toISOString() });
  }));
  return router;
}

module.exports = { createAdminRouter };
