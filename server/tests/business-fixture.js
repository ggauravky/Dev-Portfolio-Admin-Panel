const { createMongoFixture } = require("./mongo-fixture");
const { id, now, tx } = require("./financial-fixture");

const early = new Date("2026-11-24T18:29:59Z");
const today = new Date("2026-11-24T18:30:00Z");
const later = new Date("2026-11-25T03:00:00Z");
const records = {
  users: [
    { _id: id(401), displayName: "Fixture Alice", name: "Alice", email: "alice@example.test", emailVerified: true, createdAt: today,
      lastLoginAt: later, bio: "<b>Profile text</b>", googleId: "withheld-google", avatarPublicId: "withheld-avatar", lastLoginEmailEventId: "withheld-email-event", welcomeEmailSentCount: 1 },
    { _id: id(402), name: "Fixture Bob", email: "bob@example.test", emailVerified: false, createdAt: early, lastLoginAt: today },
    { _id: id(403), name: "Fixture historical", email: "historical@example.test", createdAt: early },
  ],
  contacts: [
    { _id: id(411), name: "Fixture client", email: "client@example.test", subject: "Project question", message: "<img src=x onerror=alert(1)> Fixture searchable message", status: "unread", createdAt: today, ipAddress: "withheld-client-ip" },
    { _id: id(412), name: "Fixture prior client", email: "prior@example.test", subject: "Previous inquiry", message: "Previous message", status: "replied", createdAt: early },
    ...Array.from({ length: 5 }, (_, index) => ({ _id: id(413 + index), subject: `Archive message ${index}`, status: "read", createdAt: early })),
  ],
  newsletters: [
    { _id: id(421), email: "active@example.test", subscribed: true, subscribedAt: early, createdAt: early, userAgent: "withheld-browser" },
    { _id: id(422), email: "departed@example.test", subscribed: false, subscribedAt: early, unsubscribedAt: today, createdAt: today },
    { _id: id(423), email: "unknown@example.test", createdAt: early },
  ],
  blogposts: [{ _id: id(431), title: "Fixture architecture article", slug: "uber-system-design", supportCount: 3, content: "withheld-content", createdAt: early }],
  supports: [
    { _id: id(441), userId: id(401), blogPostId: id(431), createdAt: today, blogSnapshot: { title: "Old article title" }, supporterSnapshot: { email: "withheld-supporter", picture: "withheld-image" } },
    { _id: id(442), userId: id(499), blogPostId: id(498), createdAt: early, blogSnapshot: { title: "Historical fixture article" } },
    { _id: id(443), userId: id(401), blogPostId: id(498), createdAt: later },
  ],
  activityevents: [
    { _id: id(451), userId: id(401), actionType: "payment_success", domain: "payment", status: "success", title: "Recorded payment", description: "Example payment event", amount: 123.45, currency: "INR", transactionId: String(id(461)), createdAt: today, eventKey: "withheld-event-key", metadata: { private: "withheld-activity" } },
    { _id: id(452), userId: id(401), actionType: "historical_action", domain: "historical_domain", status: "info", title: "Historical operation", transactionId: String(id(462)), createdAt: later },
    { _id: id(453), userId: id(499), actionType: "login_success", domain: "auth", status: "success", title: "Unlinked activity", createdAt: today },
  ],
  paymenttransactions: [tx(461, { userId: id(401), createdAt: today, paidAt: later }), tx(462, { userId: id(402), createdAt: early, paidAt: early })],
  bookings: [{ _id: id(471), userId: id(401), service: "Fixture booking", paymentProvider: "razorpay", paymentStatus: "paid", createdAt: today, paidAt: later }],
  paymentwebhookevents: [],
};

async function businessFixture(extra) {
  const fixture = await createMongoFixture(extra);
  try {
    for (const [name, rows] of Object.entries(records)) {
      if (rows.length) await fixture.primary.collection(name).insertMany(rows);
      else await fixture.primary.createCollection(name);
    }
    return fixture;
  } catch (error) {
    await fixture.client.close();
    throw error;
  }
}

module.exports = { businessFixture, id, now, today };
