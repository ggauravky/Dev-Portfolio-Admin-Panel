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
const { business, systemStatus } = require("../business");

const denied = () => new HttpError(403, "OPERATION_DISABLED", "This operation is disabled");

function createAdminRouter({ config, db, security, now = () => new Date(), financialNow = () => new Date(), businessNow = () => new Date() }) {
  const router = express.Router();
  const auth = (req, res, next) => security.authenticate(req).then(() => next(), next);
  const finance = financial(router, { db, auth, security, now: financialNow });
  const portfolio = business(router, { db, auth, security, now: businessNow });
  const contacts = repository(db, "contacts");
  const newsletters = repository(db, "newsletters");
  const sessionCapabilities = { ...portfolio.capabilities, ...finance.capabilities, chats: { read: true, write: false },
    system: { read: true, write: false } };
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

  for (const path of ["chats", "system"]) {
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
  router.get("/system", auth, asyncRoute(async (req, res) => send(res, await systemStatus(db, config, sessionCapabilities, req.query))));
  router.get("/stats", auth, asyncRoute(async (req, res) => {
    const chatAvailable = db.status().chat === "available";
    if (!chatAvailable) void db.connect?.("chat");
    const [businessSummary, chatSummary, financialSummary] = await Promise.all([
      portfolio.analytics({}).catch(() => null),
      chatAvailable ? analytics.summary().catch(() => null) : null,
      finance.summary().catch(() => null),
    ]);
    const inbox = businessSummary?.contacts?.data;
    const subscriptions = businessSummary?.newsletter?.data;
    const [totalContacts, unreadContacts, totalNewsletters, unsubscribedNewsletters] = await Promise.all([
      inbox?.total ?? contacts.count().catch(() => null), inbox?.unread ?? contacts.count({ status: "unread" }).catch(() => null),
      subscriptions?.active ?? newsletters.count({ subscribed: true }).catch(() => null),
      subscriptions?.unsubscribed ?? newsletters.count({ subscribed: false }).catch(() => null),
    ]);
    const bookings = financialSummary?.bookings.data;
    const payments = financialSummary?.transactions.data;
    if (!res.headersSent) res.json({ totalContacts, unreadContacts, totalNewsletters, unsubscribedNewsletters,
      totalBookings: bookings?.total ?? null, paidBookings: bookings?.confirmedPaid ?? null,
      createdBookings: bookings?.created ?? null, pendingBookings: bookings?.pending ?? null, failedBookings: bookings?.failed ?? null,
      totalSupportPayments: payments?.attempts.supportCount ?? null, paidSupportPayments: payments?.paid.supportCount ?? null,
      pendingSupportPayments: payments?.attempts.pendingSupport ?? null,
      totalChats: chatSummary?.turns ?? null, chatSummary, financialSummary, businessSummary, availability: db.status(), generatedAt: new Date().toISOString() });
  }));
  return router;
}

module.exports = { createAdminRouter };
