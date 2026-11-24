const { collectionRead, listQuery, identifier, maxTimeMS } = require("../repositories/reads");
const { financialRange, rangeFilter, only } = require("../payments/query");
const { money } = require("../payments/model");
const { invalid, missing } = require("../utils/http");
const { portfolioRevision, slugs } = require("../contracts/portfolio-articles.json");

const id = (value) => {
  if (typeof value !== "string") throw invalid("Invalid ObjectId");
  return identifier(value, "primary");
};
const isId = (value) => /^[a-f\d]{24}$/i.test(String(value ?? ""));
const projection = (fields) => Object.fromEntries(fields.split(" ").map((key) => [key, 1]));
const safe = (value, max) => typeof value === "string" ? value.slice(0, max) : null;
const statusFilter = (value) => value === "unknown" ? { $nin: [true, false] } : value === "true";
const actionTypes = ["login_success", "logout_success", "payment_success", "payment_failed", "receipt_downloaded"];
const domains = ["auth", "payment", "activity"];
const specs = {
  users: { alias: "users", search: "displayName name givenName familyName email", sort: "createdAt lastLoginAt email displayName",
    dateFields: ["createdAt", "lastLoginAt"], fields: "_id displayName name email emailVerified createdAt lastLoginAt",
    detail: "givenName familyName bio location website updatedAt lastWelcomeEmailAt lastWelcomeBackEmailAt welcomeEmailSentCount welcomeBackEmailSentCount lastLoginEmailType",
    filters: { emailVerified: ["true", "false", "unknown"] } },
  contacts: { alias: "contacts", search: "name email subject message", sort: "createdAt updatedAt date name email subject status",
    fields: "_id name email subject message status createdAt updatedAt", filters: { status: ["unread", "read", "replied"] } },
  newsletters: { alias: "newsletters", search: "email", sort: "createdAt updatedAt email subscribed subscribedAt unsubscribedAt",
    dateFields: ["createdAt", "subscribedAt", "unsubscribedAt"], fields: "_id email subscribed subscribedAt unsubscribedAt createdAt updatedAt",
    filters: { subscribed: ["true", "false", "unknown"] } },
  activity: { collection: "activityevents", alias: "activity", search: "actionType domain title description", sort: "createdAt status",
    fields: "_id userId actionType domain title description status amount currency transactionId createdAt", detail: "orderId paymentId receiptKind updatedAt",
    filters: { status: ["success", "pending", "failed", "info"] } },
  "blog-posts": { collection: "blogposts", alias: "posts", search: "title slug", sort: "createdAt updatedAt supportCount title",
    fields: "_id slug title supportCount createdAt updatedAt" },
  "blog-supports": { collection: "supports", alias: "supports", sort: "createdAt",
    fields: "_id userId blogPostId createdAt blogSnapshot.slug blogSnapshot.title" },
  transactions: { collection: "paymenttransactions", sort: "createdAt paidAt status", fields: "_id internalReference flowType amount amountPaise currency status createdAt paidAt" },
  bookings: { sort: "createdAt paidAt preferredDate", fields: "_id service paymentStatus createdAt paidAt preferredDate preferredTime" },
};

function queryFor(input, spec, fixed, now) {
  const { range, from, to, dateField = "createdAt", actionType, domain, userId, blogPostId, signupFrom, signupTo, loginFrom, loginTo, ...query } = input;
  if (!(spec.dateFields || ["createdAt"]).includes(dateField)) throw invalid("Unsupported date field");
  const dates = range === undefined && from === undefined && to === undefined ? null : financialRange({ range, from, to }, now);
  const parsed = listQuery(query, spec, fixed);
  const filter = parsed.filter;
  if (dates) filter[dateField] = rangeFilter(dates);
  for (const field of ["emailVerified", "subscribed"]) if (Object.hasOwn(filter, field)) filter[field] = statusFilter(filter[field]);
  if (userId !== undefined && ["activityevents", "supports"].includes(spec.collection) && !Object.hasOwn(fixed, "userId")) filter.userId = id(userId);
  else if (userId !== undefined) throw invalid("Unsupported user filter");
  if (blogPostId !== undefined && spec.collection === "supports") filter.blogPostId = id(blogPostId);
  else if (blogPostId !== undefined) throw invalid("Unsupported article filter");
  for (const [key, value, values] of [["domain", domain, domains], ["actionType", actionType, actionTypes]]) {
    if (value === undefined) continue;
    if (spec.collection !== "activityevents" || typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw invalid("Invalid activity filter");
    filter[key] = value === "unclassified" ? { $nin: values } : value;
  }
  for (const [start, end, field] of [[signupFrom, signupTo, "createdAt"], [loginFrom, loginTo, "lastLoginAt"]]) {
    if (start === undefined && end === undefined) continue;
    if (spec.alias !== "users" || filter[field]) throw invalid("Conflicting user date filter");
    filter[field] = rangeFilter(financialRange({ from: start, to: end }, now));
  }
  return { ...parsed, dates };
}

function createRegistry(db, now) {
  const access = (name, operation) => collectionRead(db, name, "primary")(operation);
  const aggregate = (name, pipeline) => access(name, (c) => c.aggregate(pipeline, { maxTimeMS, allowDiskUse: false }).toArray());
  const optional = async (load) => {
    try { return { status: "available", data: await load() }; }
    catch (error) { return { status: error.code === "READ_PERMISSION" ? "insufficient_permission" : "unavailable", message: "This source could not be read." }; }
  };
  const find = (name, filter, fields, sort, limit) => access(name, (c) => c.find(filter, { projection: projection(fields), maxTimeMS }).sort(sort).limit(limit).toArray());
  const lookup = async (name, ids, fields) => {
    const refs = [...new Set(ids.filter(isId).map((value) => String(value).toLowerCase()))].map(id);
    if (!refs.length) return new Map();
    const rows = await find(name, { _id: { $in: refs } }, fields, { _id: 1 }, refs.length);
    return new Map(rows.map((row) => [String(row._id), row]));
  };
  async function enrich(name, rows, details) {
    if (name === "contacts" && !details) return rows.map(({ message, ...row }) => ({ ...row, preview: safe(message, 180) }));
    if (name === "transactions") return rows.map(({ amount, amountPaise, currency, ...row }) => ({ ...row, ...money({ amount, amountPaise, currency }) }));
    if (name === "blog-posts") {
      const counts = await optional(async () => new Map((await aggregate("supports", [
        { $match: { blogPostId: { $in: rows.map((row) => row._id) } } }, { $group: { _id: "$blogPostId", count: { $sum: 1 } } },
      ])).map((row) => [String(row._id), row.count])));
      return rows.map((row) => {
        const actualSupportCount = counts.data ? counts.data.get(String(row._id)) || 0 : null;
        return { ...row, actualSupportCount, consistency: actualSupportCount === null ? counts.status :
          !Number.isSafeInteger(row.supportCount) ? "counter_unrecorded" : actualSupportCount === row.supportCount ? "matches" : "counter_mismatch",
        publicUrl: slugs.includes(row.slug) ? `https://ggauravky.vercel.app/blog/${row.slug}` : null };
      });
    }
    if (name !== "activity" && name !== "blog-supports") return rows;
    const blog = name === "blog-supports";
    const [users, linked] = await Promise.all([
      optional(() => lookup("users", rows.map((row) => row.userId), "_id displayName name")),
      optional(() => blog ? lookup("blogposts", rows.map((row) => row.blogPostId), "_id title slug") :
        lookup("paymenttransactions", rows.map((row) => row.transactionId), "_id internalReference userId provider")),
    ]);
    return rows.map((row) => {
      const user = users.data?.get(String(row.userId).toLowerCase());
      const entity = linked.data?.get(String(blog ? row.blogPostId : row.transactionId).toLowerCase());
      const userLink = user ? { state: "linked", id: user._id, name: user.displayName || user.name } : { state: !row.userId ? "not_recorded" : users.data ? "missing" : users.status };
      if (blog) {
        const { blogSnapshot, ...record } = row;
        const snapshotTitle = safe(blogSnapshot?.title, 220);
        const snapshotSlug = safe(blogSnapshot?.slug, 180);
        return { ...record, user: userLink, article: entity ? { state: "linked", id: entity._id, title: entity.title, slug: entity.slug, snapshotTitle, snapshotSlug,
          snapshotMismatch: Boolean(snapshotTitle && snapshotTitle !== entity.title || snapshotSlug && snapshotSlug !== entity.slug) } :
          { state: !row.blogPostId ? "not_recorded" : linked.data ? "missing" : linked.status, snapshotTitle, snapshotSlug } };
      }
      const compatible = entity?.provider === "razorpay" && row.userId && String(entity.userId) === String(row.userId);
      return { ...row, user: userLink, transaction: compatible ? { state: "linked", id: entity._id, reference: entity.internalReference } :
        { state: entity ? "ownership_unverified" : !row.transactionId ? "not_recorded" : linked.data ? "missing" : linked.status } };
    });
  }
  async function list(name, query, fixed = {}) {
    const spec = specs[name];
    const kind = spec.collection || name;
    const q = queryFor(query, spec, fixed, now());
    const [rows, total] = await access(kind, (c) => Promise.all([
      c.find(q.filter, { projection: projection(spec.fields), maxTimeMS }).sort(q.sort).skip(q.skip).limit(q.pageSize).toArray(),
      c.countDocuments(q.filter, { maxTimeMS }),
    ]));
    const items = await enrich(name, rows, false);
    return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.min(Math.ceil(total / q.pageSize), Math.floor(10000 / q.pageSize) + 1), ...(q.dates ? { dates: q.dates } : {}) };
  }
  async function detail(name, value, query) {
    only(query, []);
    const spec = specs[name];
    const _id = id(value);
    const result = await access(spec.collection || name, (c) => c.findOne({ _id }, { maxTimeMS, projection: projection([spec.fields, spec.detail].filter(Boolean).join(" ")) }));
    if (!result) throw missing();
    return (await enrich(name, [result], true))[0];
  }
  return { list, detail, optional, aggregate, access, find, lookup };
}

module.exports = { createRegistry, specs, id, actionTypes, domains, portfolioRevision };
