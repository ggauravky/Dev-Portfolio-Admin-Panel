const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { createApp } = require("../app");

test("removed admin routes return 404 while retained routes stay protected", async (t) => {
  const app = createApp({
    config: { origins: [], email: "owner@example.test", password: "fixture password", sessionSecret: "s".repeat(32), maxHours: 8 },
    db: { get() { throw new Error("Unexpected database access"); } },
    log: () => {},
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(
    () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  );
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const detail = "/mllogs/507f1f77bcf86cd799439011";
  const requests = [
    ["GET", "/mllogs"],
    ["GET", detail],
    ["DELETE", detail],
    ["POST", "/mllogs/bulk-delete"],
    ["GET", "/sessions"],
    ["POST", "/sessions/revoke-all"],
    ["DELETE", "/sessions/507f1f77-0000-4000-8000-000000000001"],
    ["GET", "/audit-events"],
    ["GET", "/audit-events/abcd"],
  ];

  for (const [method, path] of requests) {
    const response = await fetch(base + path, { method });
    await response.arrayBuffer();
    assert.equal(response.status, 404, `${method} ${path}`);
  }

  const stats = await fetch(base + "/stats");
  await stats.arrayBuffer();
  assert.equal(stats.status, 401);
});

test("server code never calls MongoDB write operations", () => {
  const { readdirSync, readFileSync, statSync } = require("node:fs");
  const { join } = require("node:path");
  const root = join(__dirname, "..");
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (["node_modules", "tests"].includes(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".js")) files.push(path);
    }
  })(root);
  const writes = /\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|findOneAndUpdate|findOneAndReplace|findOneAndDelete|bulkWrite|createIndex|createIndexes|dropIndex|drop|createCollection|dropDatabase)\(|\$(merge|out)\b/;
  assert.deepEqual(files.filter((file) => writes.test(readFileSync(file, "utf8"))).map((file) => file.slice(root.length + 1)), []);
});
