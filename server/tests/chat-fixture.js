const { createMongoFixture } = require("./mongo-fixture");
const manifest = require("../contracts/portfolio-chat-corpus.json");
const uid = (value) => "507f1f77-0000-4000-8000-" + String(value).padStart(12, "0");
const now = () => new Date("2026-11-25T13:45:00.000Z");
const owner = "a".repeat(32);
const sessionId = uid(300);
const firstSource = manifest.chunks.find((chunk) => chunk.url);
const make = (id, time, patch) => ({
  _id: uid(id), sessionId, owner, ipHash: "private-fixture-ip",
  question: "Fixture question " + id, answer: "Fixture answer " + id, intent: "question", provider: "groq",
  cached: false, matched: true, aborted: false, retrieval: "hybrid", corpusVersion: manifest.version,
  chunkIds: [firstSource.id], createdAt: new Date(time), futurePrivateAttribute: "exclude-this-field", ...patch,
});
const rows = [
  make(1, "2026-11-24T18:29:00Z", { latencyMs: 110, question: "Question [literal]" }),
  make(2, "2026-11-24T18:31:00Z", { latencyMs: 220, cached: true, retrieval: "cache",
    answer: "Fixture answer 2 <em>escaped</em> " + "long-word".repeat(350) }),
  make(3, "2026-11-24T18:32:00Z", { latencyMs: 390, owner: "b".repeat(32), provider: "faq", retrieval: "keyword" }),
  make(4, "2026-11-24T18:34:00Z", { owner: undefined, provider: "historical-provider", cached: undefined, matched: undefined, aborted: undefined, corpusVersion: "0".repeat(16) }),
  make(5, "2026-11-24T18:35:00Z", { owner: undefined, provider: "template", matched: false, aborted: true, retrieval: "none", intent: "greeting", latencyMs: 19900, chunkIds: [] }),
  make(6, "2026-11-24T18:36:00Z", { sessionId: uid(301), provider: "gemini", matched: false, retrieval: "keyword", intent: "declined", latencyMs: 610 }),
];

async function chatFixture(extra) {
  const fixture = await createMongoFixture(extra);
  const chat = fixture.client.db("portfolio_chat");
  for (const row of rows) await chat.collection("chat_turns").replaceOne({ _id: row._id }, row, { upsert: true, ignoreUndefined: true });
  const start = Math.floor(+now() / 60000) * 60000;
  for (const [name, collection, doc] of [
    ["fixture-rpm", "chat_rate", { key: "q:groq:rpm", count: 4, windowStart: start, expireAt: new Date(start + 65000) }],
    ["fixture-stale", "chat_rate", { key: "q:gemini:rpm", count: 70, windowStart: start - 60000, expireAt: new Date(start - 1) }],
    ["fixture-unrelated", "chat_rate", { key: "internal-visitor-key", count: 100, windowStart: start, expireAt: new Date(start + 65000) }],
    ["cool:groq", "chat_locks", { expireAt: new Date(start + 20000) }],
    ["cool:gemini", "chat_locks", { expireAt: new Date(start - 1) }],
    ["private-fixture-lock", "chat_locks", { expireAt: new Date(start + 20000) }],
    ["fixture-cache", "chat_cache", { value: { answer: "never-return-this" }, expireAt: new Date(start + 300000) }],
    ["fixture-stale-cache", "chat_cache", { value: { answer: "never-return-this" }, expireAt: new Date(start - 1) }],
  ]) await chat.collection(collection).replaceOne({ _id: name }, { _id: name, ...doc }, { upsert: true });
  fixture.config.chat = { uri: "mongodb://127.0.0.1:39173", name: "portfolio_chat" };
  return fixture;
}
module.exports = { chatFixture, now, uid, sessionId, firstSource };
