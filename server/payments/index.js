const { HttpError, asyncRoute, send, missing } = require("../utils/http");
const { createAccess, optional, list, page, maxTimeMS } = require("./access");
const { transactionQuery, bookingQuery, webhookQuery, webhookScope, legacyQuery, objectId, only } = require("./query");
const { project, pick, transaction, webhook, idString } = require("./model");
const { txLinks, bookingLinks } = require("./relations");
const { createDiagnostics, classifyBooking } = require("./diagnostics");
const { createFinancialAnalytics } = require("./analytics");

const resources = {
  transactions: ["transactions", "transactions"], bookings: ["bookings", "bookings"],
  "support-payments": ["transactions", "supportPayments"], receipts: ["transactions", "receipts"],
  "webhook-events": ["webhooks", "events"], "legacy-payments": ["legacy", "legacyPayments"],
};

function getOne(access, kind, id, projection, fixed = {}) {
  const _id = objectId(id);
  return access.run(kind, async (c) => {
    const row = await c.findOne({ _id, ...fixed }, { projection, maxTimeMS });
    if (!row) throw missing();
    return row;
  });
}

function receiptRow(row, now) {
  const safe = transaction(row, now, true);
  return { _id: safe._id, internalReference: safe.internalReference, flowType: safe.flowType, status: safe.status,
    amountPaise: safe.amountPaise, currency: safe.currency, amountIssue: safe.amountIssue, createdAt: safe.createdAt, paidAt: safe.paidAt,
    receipt: safe.receipt };
}

function receiptProjection() {
  const { _id, internalReference, flowType, status, amount, amountPaise, currency, createdAt, paidAt, ...rest } = project("transactions", "detail");
  return { _id, internalReference, flowType, status, amount, amountPaise, currency, createdAt, paidAt,
    ...Object.fromEntries(Object.entries(rest).filter(([field]) => /^(receipt|adminEmail)/.test(field))) };
}

function financial(router, { db, auth, security, now }) {
  const access = createAccess(db);
  const analytics = createFinancialAnalytics(access, now);
  const diagnostics = createDiagnostics(access, now);
  const paths = [...Object.keys(resources), "financial-analytics", "financial-reconciliation"];

  for (const path of paths) {
    router.use("/" + path, (req, res, next) => {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
      return auth(req, res, (error) => {
        if (error) return next(error);
        void security.authorizationDenied(req).then(
          () => next(new HttpError(403, "OPERATION_DISABLED", "Financial operations are read-only.")), next);
      });
    });
  }

  for (const [path, [kind, alias]] of Object.entries(resources)) {
    const query = kind === "transactions" ? transactionQuery : kind === "bookings" ? bookingQuery : kind === "webhooks" ? webhookQuery : legacyQuery;
    const fixed = path === "support-payments" ? { flowType: "support" } : {};
    router.get("/" + path, auth, asyncRoute(async (req, res) => {
      const at = now();
      const q = query(req.query, at, fixed);
      let data;
      if (path === "receipts") {
        data = await list(access, kind, q, receiptProjection(), (row) => receiptRow(row, at));
      } else if (kind === "bookings") {
        if (q.view === "review") {
          const candidates = await access.run(kind, (c) => c.find(q.filter, { projection: project(kind), maxTimeMS }).sort(q.sort).limit(201).toArray());
          const scanned = candidates.slice(0, 200);
          const links = await bookingLinks(access, scanned);
          const issues = scanned.flatMap((row, index) => classifyBooking(row, links[index]).length ? [{ ...pick(row, project(kind)), link: links[index] }] : []);
          data = { ...page(q, issues.slice(q.skip, q.skip + q.pageSize), issues.length), scanned: scanned.length, truncated: candidates.length > 200 };
        } else {
          data = await list(access, kind, q, project(kind));
          data.links = await optional(async () => (await bookingLinks(access, data.items)).map((link, i) => ({ id: data.items[i]._id, ...link })));
        }
      } else {
        const mapper = kind === "transactions" ? (row) => transaction(row, at) : kind === "webhooks" ? (row) => webhook(row, false) : undefined;
        data = await list(access, kind, q, project(kind), mapper);
      }
      if (!res.headersSent) res.json({ success: true, data: { ...data, dates: q.dates }, [alias]: data.items, total: data.total });
    }));

    router.get("/" + path + "/:id", auth, asyncRoute(async (req, res) => {
      only(req.query, []);
      const at = now();
      const queryFixed = kind === "transactions" ? { provider: "razorpay", ...fixed } : kind === "webhooks" ? webhookScope : fixed;
      const row = await getOne(access, kind, req.params.id, path === "receipts" ? receiptProjection() : project(kind, "detail"), queryFixed);
      let data;
      if (path === "receipts") {
        data = receiptRow(row, at);
      } else if (kind === "transactions") {
        const [booking, events] = await Promise.all([
          optional(async () => (await txLinks(access, [row]))[0]),
          optional(async () => {
            const found = await access.run("webhooks", (c) => c.find({ provider: "razorpay", transactionId: row._id },
              { projection: project("webhooks"), maxTimeMS }).sort({ createdAt: -1, _id: -1 }).limit(11).toArray());
            return { items: found.slice(0, 10).map((event) => webhook(event, false)), more: found.length > 10 };
          }),
        ]);
        data = { ...transaction(row, at, true), booking, webhooks: events };
      } else if (kind === "bookings") {
        const link = await optional(async () => (await bookingLinks(access, [row]))[0]);
        data = { ...pick(row, project(kind, "detail")), transaction: link };
      } else if (kind === "webhooks") {
        const link = row.transactionId == null ? { status: "not_recorded" } : !idString(row.transactionId) ? { status: "invalid_reference" } :
          await optional(async () => {
            const tx = await access.run("transactions", (c) => c.findOne({ _id: row.transactionId, provider: "razorpay" },
              { projection: { _id: 1, internalReference: 1, status: 1 }, maxTimeMS }));
            return tx ? { status: "linked", _id: tx._id, internalReference: tx.internalReference, paymentStatus: tx.status } : { status: "missing" };
          });
        data = { ...webhook(row, true), transaction: link };
      } else data = pick(row, project(kind, "detail"));
      if (!res.headersSent) res.json(data);
    }));
  }

  router.get("/financial-analytics", auth, asyncRoute(async (req, res) => send(res, await analytics.full(req.query))));
  router.get("/financial-reconciliation", auth, asyncRoute(async (req, res) => send(res, await diagnostics(req.query))));
  return {
    summary: analytics.summary,
    capabilities: Object.fromEntries(paths.map((path) => [path, { read: true, write: false }])),
  };
}

module.exports = { financial };
