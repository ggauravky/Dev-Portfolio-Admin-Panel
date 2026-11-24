const express = require("express");
const { repository } = require("../repositories/reads");
const { HttpError, send, asyncRoute } = require("../utils/http");
const { createChatAccess } = require("../chat/access");
const { createConversations } = require("../chat/conversations");
const { createAnalytics } = require("../chat/analytics");
const { createOperations } = require("../chat/operations");
const { createKnowledge } = require("../chat/knowledge");
const { only } = require("../chat/query");
const { financial } = require("../payments");

const resources = {
  contacts: ["contacts", "contacts"], newsletters: ["newsletters", "newsletters"],
  users: ["users", "users"], activity: ["activityevents", "activity"],
  "blog-posts": ["blogposts", "posts"],
  "blog-supports": ["supports", "supports"],
};
const capabilities = Object.fromEntries(Object.keys(resources).map((path) => [path, { read: true, write: false }]));
const denied = () => new HttpError(403, "OPERATION_DISABLED", "This operation is disabled");

function createAdminRouter({ config, db, security, now = () => new Date(), financialNow = () => new Date() }) {
  const router = express.Router();
  const repositories = {};
  const auth = (req, res, next) => security.authenticate(req).then(() => next(), next);
  const finance = financial(router, { db, auth, security, now: financialNow });
  const sessionCapabilities = { ...capabilities, ...finance.capabilities, chats: { read: true, write: false }, sessions: { read: true, revoke: true } };
  const access = createChatAccess(db);
  const chat = createConversations(access, now);
  const analytics = createAnalytics(access, now);
  const operations = createOperations(access, db, now);
  const knowledge = createKnowledge(access, now);
  router.post("/login", asyncRoute(async (req, res) => {
    const data = await security.login(req, res);
    if (data) send(res, { ...data, capabilities: sessionCapabilities });
  }));
  router.get("/me", auth, (req, res) => send(res, { ...security.me(req), capabilities: sessionCapabilities }));
  router.post("/logout", asyncRoute(async (req, res) => {
    await security.logout(req, res);
    send(res, { loggedOut: true });
  }));
  router.get("/sessions", auth, asyncRoute(async (req, res) => send(res, { items: await security.list(req) })));
  for (const [method, path, scope] of [
    ["delete", "/sessions/:id", "one"], ["post", "/sessions/revoke-others", "others"], ["post", "/sessions/revoke-all", "all"],
  ]) {
    router[method](path, auth, asyncRoute(async (req, res) => send(res, await security.revokeSessions(req, res, scope))));
  }

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
  }
  for (const path of [...Object.keys(resources), "chats"]) {
    for (const [method, suffix] of [["post", ""], ["post", "/bulk-delete"], ["put", "/:id"], ["patch", "/:id"], ["delete", "/:id"]]) {
      router[method]("/" + path + suffix, auth, asyncRoute(async (req) => {
        await security.authorizationDenied(req);
        throw denied();
      }));
    }
  }
  router.get("/chats", auth, asyncRoute(async (req, res) => {
    const data = await chat.turns(req.query);
    if (!res.headersSent) res.json({ success: true, data, chats: data.items, total: data.total });
  }));
  router.get("/chats/:id", auth, asyncRoute(async (req, res) => {
    const record = await chat.turn(req.params.id);
    if (!res.headersSent) res.json(record);
  }));
  router.get("/chat-conversations", auth, asyncRoute(async (req, res) => send(res, await chat.list(req.query))));
  router.get("/chat-conversations/:reference", auth, asyncRoute(async (req, res) => send(res, await chat.details(req.params.reference, req.query))));
  router.get("/chat-analytics", auth, asyncRoute(async (req, res) => send(res, await analytics.full(req.query))));
  router.get("/chat-operations", auth, asyncRoute(async (req, res) => {
    only(req.query, []);
    send(res, await operations());
  }));
  router.get("/chat-knowledge", auth, asyncRoute(async (req, res) => send(res, await knowledge(req.query))));
  router.get("/system", auth, asyncRoute(async (req, res) => {
    await Promise.all([db.connect?.("primary"), db.connect?.("chat")]);
    const dependencies = db.status();
    send(res, { dependencies, configuration: "valid", ready: dependencies.primary === "available" && dependencies.admin === "available", readOnly: true, globalReadOnly: config.readOnly, capabilities: sessionCapabilities });
  }));
  router.get("/stats", auth, asyncRoute(async (req, res) => {
    const count = (path, filter) => repositories[path].count(filter);
    const chatAvailable = db.status().chat === "available";
    if (!chatAvailable) void db.connect?.("chat");
    const metrics = {
      totalContacts: count("contacts"), unreadContacts: count("contacts", { status: "unread" }),
      totalNewsletters: count("newsletters", { subscribed: { $ne: false } }),
      unsubscribedNewsletters: count("newsletters", { subscribed: false }),
    };
    const [results, chatSummary, financialSummary] = await Promise.all([
      Promise.allSettled(Object.values(metrics)),
      chatAvailable ? analytics.summary().catch(() => null) : null,
      finance.summary().catch(() => null),
    ]);
    if (results.every(({ status }) => status === "rejected") && !chatSummary &&
        !["transactions", "bookings", "webhooks"].some((key) => financialSummary?.[key]?.status === "available")) {
      throw new HttpError(503, "DEPENDENCY_UNAVAILABLE", "Portfolio statistics are unavailable");
    }
    const values = Object.fromEntries(Object.keys(metrics).map((key, index) => [key, results[index].status === "fulfilled" ? results[index].value : null]));
    const bookings = financialSummary?.bookings.data;
    const payments = financialSummary?.transactions.data;
    if (!res.headersSent) res.json({ ...values,
      totalBookings: bookings?.total ?? null, paidBookings: bookings?.confirmedPaid ?? null,
      createdBookings: bookings?.created ?? null, pendingBookings: bookings?.pending ?? null, failedBookings: bookings?.failed ?? null,
      totalSupportPayments: payments?.attempts.supportCount ?? null, paidSupportPayments: payments?.paid.supportCount ?? null,
      pendingSupportPayments: payments?.attempts.pendingSupport ?? null,
      totalChats: chatSummary?.turns ?? null, chatSummary, financialSummary, availability: db.status(), generatedAt: new Date().toISOString() });
  }));
  return router;
}

module.exports = { createAdminRouter };
