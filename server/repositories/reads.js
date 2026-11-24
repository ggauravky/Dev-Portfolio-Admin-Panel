const { mongo: { ObjectId } } = require("mongoose");
const { invalid, missing, unavailable } = require("../utils/http");
const contract = require("../contracts/portfolio-schema.json");

const specs = {
  contacts: { search: "name email subject message", sort: "createdAt updatedAt date name email subject status", filters: { status: ["unread", "read", "replied"] }, exclude: "ipAddress userAgent" },
  newsletters: { search: "email", sort: "createdAt updatedAt email subscribed subscribedAt unsubscribedAt", filters: { subscribed: [true, false] }, exclude: "ipAddress userAgent" },
  bookings: { search: "name email service serviceSlug paymentId orderId phone", sort: "createdAt updatedAt date preferredDate name email amount paymentStatus paidAt", filters: { paymentStatus: ["created", "pending", "paid", "failed"], paymentProvider: ["razorpay", "cashfree"] }, exclude: "ipAddress userAgent receiptEmailRecipient receiptEmailMessageId receiptEmailError adminEmailMessageId adminEmailError lastReconciliationError" },
  paymenttransactions: { search: "customerName contributorName email phone internalReference razorpayOrderId razorpayPaymentId receiptNumber", sort: "createdAt updatedAt paidAt amount amountPaise status", filters: { flowType: ["service", "support"], status: ["created", "pending", "authorized", "paid", "failed", "refunded"], provider: ["razorpay"] }, exclude: "ipAddress userAgent metadata receiptEmailMessageId adminEmailMessageId receiptEmailError adminEmailError failureReason" },
  chat_turns: { search: "question answer intent sessionId", sort: "createdAt latencyMs provider cached", filters: { cached: [true, false], aborted: [true, false] }, exclude: "owner ipHash" },
  users: { fields: "_id displayName name email emailVerified createdAt lastLoginAt", search: "displayName name email", sort: "createdAt lastLoginAt email" },
  activityevents: { fields: "_id userId actionType domain status title amount currency transactionId createdAt", search: "actionType domain title", sort: "createdAt status", filters: { status: ["success", "pending", "failed", "info"] } },
  paymentwebhookevents: { fields: "_id eventId eventType provider status transactionId attempts processedAt createdAt", search: "eventId eventType", sort: "createdAt processedAt status", filters: { status: ["processing", "processed", "failed", "ignored"] } },
  blogposts: { fields: "_id title slug supportCount createdAt updatedAt", search: "title slug", sort: "createdAt supportCount title" },
  supports: { fields: "_id userId blogPostId createdAt", sort: "createdAt" },
};
const maxTimeMS = 2000;
const words = (value) => value?.split(" ") ?? [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identifier(value, kind) {
  if (kind === "chat") {
    if (!uuid.test(value)) throw invalid("Invalid UUID");
    return value.toLowerCase();
  }
  if (!/^[0-9a-f]{24}$/i.test(value)) throw invalid("Invalid ObjectId");
  return new ObjectId(value);
}

function whole(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!/^\d{1,5}$/.test(value) || Number(value) < min || Number(value) > max) throw invalid("Invalid pagination");
  return Number(value);
}

function listQuery(query, spec, fixed) {
  const allowed = ["search", "sortBy", "order", "limit", "pageSize", "skip", "page", "from", "to", ...Object.keys(spec.filters || {})];
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key) || typeof value !== "string") throw invalid("Unsupported query parameter");
  }
  if (query.pageSize !== undefined && query.limit !== undefined || query.page !== undefined && query.skip !== undefined) throw invalid("Conflicting pagination parameters");
  const pageSize = whole(query.pageSize ?? query.limit, 25, 1, 100);
  const page = whole(query.page, 1, 1, 10001);
  const skip = whole(query.skip, (page - 1) * pageSize, 0, 10000);
  if (skip > 10000 || skip % pageSize) throw invalid("Unsupported pagination offset");
  const field = query.sortBy ?? "createdAt";
  if (!words(spec.sort).includes(field) || !["asc", "desc"].includes(query.order ?? "desc")) throw invalid("Unsupported sorting");
  const dir = query.order === "asc" ? 1 : -1;
  const filter = { ...fixed };
  for (const [key, values] of Object.entries(spec.filters || {})) {
    if (query[key] === undefined) continue;
    const value = values.find((item) => String(item) === query[key]);
    if (value === undefined || (Object.hasOwn(fixed, key) && fixed[key] !== value)) throw invalid("Unsupported filter value");
    filter[key] = value;
  }
  if (query.search !== undefined) {
    const search = query.search.trim();
    if (search.length > 100 || !spec.search) throw invalid("Unsupported search");
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = words(spec.search).map((key) => ({ [key]: { $regex: escaped, $options: "i" } }));
    }
  }
  if (query.from !== undefined || query.to !== undefined) {
    const range = {};
    for (const [param, operator] of [["from", "$gte"], ["to", "$lt"]]) {
      if (query[param] === undefined) continue;
      const value = query[param];
      const date = new Date(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw invalid("Dates must use YYYY-MM-DD");
      range[operator] = date;
    }
    if (range.$gte >= range.$lt) throw invalid("Invalid date range");
    filter.createdAt = range;
  }
  return { filter, sort: { [field]: dir, _id: dir }, skip, page: skip / pageSize + 1, pageSize };
}

function repository(db, collection, fixed = {}) {
  const spec = specs[collection];
  const definition = contract.collections[collection];
  const fields = spec.fields ? words(spec.fields) : Object.keys(definition.fields).filter((key) => !key.includes(".") && key !== "__v" && !words(spec.exclude).includes(key));
  const projection = Object.fromEntries(fields.map((field) => [field, 1]));
  const dependency = definition.database;
  async function access(operation) {
    await db.connect?.(dependency);
    const database = db.get(dependency);
    if (!database || db.hasCollection?.(dependency, collection) === false) throw unavailable(dependency);
    try {
      return await operation(database.collection(collection));
    } catch (error) {
      if (/Mongo(Network|ServerSelection|NotConnected)/.test(error.name)) db.invalidate?.(dependency);
      throw unavailable(dependency);
    }
  }
  return {
    list(query) {
      const { filter, sort, skip, page, pageSize } = listQuery(query, spec, fixed);
      return access(async (data) => {
        const [items, total] = await Promise.all([
          data.find(filter, { projection, maxTimeMS }).sort(sort).skip(skip).limit(pageSize).toArray(),
          data.countDocuments(filter, { maxTimeMS }),
        ]);
        return { items, total, page, pageSize, totalPages: Math.min(Math.ceil(total / pageSize), Math.floor(10000 / pageSize) + 1) };
      });
    },
    async detail(value) {
      const _id = identifier(value, dependency);
      const record = await access((data) => data.findOne({ _id, ...fixed }, { projection, maxTimeMS }));
      if (!record) throw missing();
      return record;
    },
    count(filter = {}) {
      return access((data) => data.countDocuments({ ...filter, ...fixed }, { maxTimeMS }));
    },
  };
}

module.exports = { repository };
