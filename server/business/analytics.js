const { financialRange, rangeFilter, only } = require("../payments/query");
const { shortCache } = require("../chat/access");
const { zone } = require("../chat/query");
const { actionTypes, domains } = require("./registry");
const { maxTimeMS } = require("../repositories/reads");

const label = (field, known) => ({ $cond: [{ $in: ["$" + field, known] }, "$" + field, "unclassified"] });
const group = (key) => [{ $group: { _id: key, count: { $sum: 1 } } }, { $sort: { _id: 1 } }];
const normalize = (entries) => (entries || []).map(({ _id: key, count }) => ({ key, count }));
const count = (entries) => entries?.[0]?.count || 0;
const byDay = (field) => group({ $dateToString: { date: "$" + field, timezone: zone, format: "%Y-%m-%d" } });
const matches = (field, window) => ({ $match: { [field]: window } });
const total = [{ $count: "count" }];
const bool = (field, state) => [{ $match: { [field]: state } }, ...total];
const recent = (fields) => [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 5 }, { $project: fields }];

function createBusinessAnalytics(registry, now) {
  const cache = shortCache({ ttl: 30000, cap: 20 });
  const facet = async (name, pipeline, fields) => (await registry.aggregate(name, [{ $project: fields }, { $facet: pipeline }]))[0] || {};
  const task = (load) => registry.optional(load);
  const confirmRead = (collection) => registry.access(collection, (source) => source.findOne({}, { projection: { _id: 1 }, maxTimeMS }));
  async function load(dates) {
    const window = rangeFilter(dates);
    const created = matches("createdAt", window);
    const [users, contacts, newsletter] = await Promise.all([
      task(async () => {
        const data = await facet("users", { total, verified: bool("emailVerified", true), unverified: bool("emailVerified", false),
          logins: [matches("lastLoginAt", window), ...total], daily: [created, ...byDay("createdAt")], recent: [created, ...recent({ createdAt: 1 })] },
        { emailVerified: 1, createdAt: 1, lastLoginAt: 1 });
        const daily = normalize(data.daily);
        return { total: count(data.total), verified: count(data.verified), unverified: count(data.unverified),
          verificationUnknown: count(data.total) - count(data.verified) - count(data.unverified), lastLoginInPeriod: count(data.logins),
          registrations: daily.reduce((sum, row) => sum + row.count, 0), daily, recent: data.recent || [] };
      }),
      task(async () => {
        const data = await facet("contacts", { statuses: group(label("status", ["unread", "read", "replied"])), daily: [created, ...byDay("createdAt")],
          recent: [created, ...recent({ createdAt: 1 })] }, { status: 1, createdAt: 1 });
        const statuses = normalize(data.statuses);
        const daily = normalize(data.daily);
        return { total: statuses.reduce((sum, row) => sum + row.count, 0), unread: statuses.find((row) => row.key === "unread")?.count || 0,
          received: daily.reduce((sum, row) => sum + row.count, 0), statuses, daily, recent: data.recent || [] };
      }),
      task(async () => {
        const data = await facet("newsletters", { total, active: bool("subscribed", true), unsubscribed: bool("subscribed", false),
          recentUnsubscribes: [matches("unsubscribedAt", window), ...total], daily: [created, ...byDay("createdAt")] },
        { subscribed: 1, createdAt: 1, unsubscribedAt: 1 });
        const daily = normalize(data.daily);
        return { total: count(data.total), active: count(data.active), unsubscribed: count(data.unsubscribed),
          unknown: count(data.total) - count(data.active) - count(data.unsubscribed), unsubscribeTimestamps: count(data.recentUnsubscribes),
          newRecords: daily.reduce((sum, row) => sum + row.count, 0), daily };
      }),
    ]);
    const [activity, engagement, transactions] = await Promise.all([
      task(async () => {
        const [data] = await registry.aggregate("activityevents", [{ $facet: { total, daily: [created, ...byDay("createdAt")],
          domains: [created, ...group(label("domain", domains))], actions: [created, ...group(label("actionType", actionTypes))],
          statuses: [created, ...group(label("status", ["success", "pending", "failed", "info"]))] } }]);
        const linked = await task(async () => {
          await confirmRead("users");
          // This is an equality lookup on the canonical user _id index after deduplication.
          const [row] = await registry.aggregate("activityevents", [created, { $match: { userId: { $type: "objectId" } } },
            { $group: { _id: "$userId" } }, { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "match" } },
            { $match: { "match.0": { $exists: true } } }, { $count: "count" }]);
          return row?.count || 0;
        });
        const daily = normalize(data?.daily);
        return { total: count(data?.total), recorded: daily.reduce((sum, row) => sum + row.count, 0), daily, linkedUsers: linked,
          domains: normalize(data?.domains), actions: normalize(data?.actions), statuses: normalize(data?.statuses) };
      }),
      task(async () => {
        const articleGroups = [{ $match: { blogPostId: { $type: "objectId" } } }, { $group: { _id: "$blogPostId", count: { $sum: 1 } } }];
        const [data, articles] = await Promise.all([
          facet("supports", { total, daily: [created, ...byDay("createdAt")], recent: [created, ...recent({ createdAt: 1 })],
            users: [{ $match: { userId: { $type: "objectId" } } }, { $group: { _id: "$userId" } }, ...total], articles: [...articleGroups, ...total],
          }, { userId: 1, blogPostId: 1, createdAt: 1 }),
          task(async () => {
            await confirmRead("blogposts");
            const [result] = await registry.aggregate("supports", [...articleGroups,
              { $lookup: { from: "blogposts", localField: "_id", foreignField: "_id", pipeline: [{ $project: { title: 1, slug: 1 } }], as: "article" } },
              { $unwind: "$article" }, { $facet: { count: total, top: [{ $sort: { count: -1, _id: 1 } }, { $limit: 5 }] } },
            ]);
            return { count: count(result?.count), top: (result?.top || []).map(({ _id: id, count, article }) => ({ id, count, article })) };
          }),
        ]);
        const daily = normalize(data.daily);
        return { total: count(data.total), distinctSupporterIds: count(data.users), distinctArticleIds: count(data.articles),
          received: daily.reduce((sum, row) => sum + row.count, 0), daily, recent: data.recent || [],
          top: articles.data?.top || [], supportedArticles: articles.data?.count ?? null, articlesStatus: articles.status };
      }),
      task(() => registry.find("paymenttransactions", { provider: "razorpay", createdAt: window }, "_id createdAt", { createdAt: -1, _id: -1 }, 5)),
    ]);
    const timeline = [
      ["User registered", "users", users.data?.recent], ["Contact received", "contacts", contacts.data?.recent],
      ["Blog support recorded", "blog-supports", engagement.data?.recent], ["Razorpay transaction recorded", "transactions", transactions.data],
    ].flatMap(([title, source, items = []]) => items.map((row) => ({ id: row._id, timestamp: row.createdAt, source, title })))
      .sort((a, b) => +b.timestamp - +a.timestamp || String(b.id).localeCompare(String(a.id)) || a.source.localeCompare(b.source)).slice(0, 12);
    return { dates, generatedAt: now(), users, contacts, newsletter, activity, engagement, timeline, timelinePaymentSource: transactions.status };
  }
  async function report(query) {
    only(query, ["range", "from", "to"]);
    const dates = financialRange(Object.keys(query).length ? query : { range: "7d" }, now());
    return cache(`${+dates.from}:${+dates.to}`, () => load(dates));
  }
  return report;
}

module.exports = { createBusinessAnalytics };
