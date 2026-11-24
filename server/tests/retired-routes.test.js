const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const express = require("express");
const adminRoutes = require("../routes/adminRoutes");

test("removed admin routes return 404 while retained routes stay protected", async (t) => {
  const app = express();
  app.use("/api/admin", adminRoutes);
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
