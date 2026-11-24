const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { test } = require("node:test");

test("Vercel handler forwards only the scoped cookie and approved headers and rejects redirects", async (t) => {
  const { default: handler } = await import("../../api/admin-proxy.js");
  const nativeFetch = global.fetch;
  const previous = [process.env.ADMIN_API_UPSTREAM, process.env.ADMIN_PROXY_SECRET];
  process.env.ADMIN_API_UPSTREAM = "https://fixed-upstream.example.test";
  process.env.ADMIN_PROXY_SECRET = "1".repeat(64);
  const cookie = "__Secure-portfolio_admin=" + "b".repeat(43);
  const seen = [];
  let redirects = false;
  global.fetch = async (url, options) => {
    seen.push({ url, options });
    if (redirects) return new Response(null, { status: 302, headers: { Location: "https://elsewhere.example" } });
    return new Response('{"success":true}', {
      status: 200, headers: [["content-type", "application/json"], ["set-cookie", cookie + "; Path=/api/admin; Secure; HttpOnly"], ["set-cookie", "unrelated=private"]],
    });
  };
  const server = createServer((req, res) => {
    req.query = Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
    void handler(req, res);
  }).listen(0, "127.0.0.1");
  t.after(async () => {
    global.fetch = nativeFetch;
    for (const [index, name] of ["ADMIN_API_UPSTREAM", "ADMIN_PROXY_SECRET"].entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
    await new Promise((resolve) => server.close(resolve));
  });
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await nativeFetch(base + "/?__admin_path=me", {
    headers: { cookie: cookie + "; ignored=private", authorization: "Bearer ignored", "x-admin-client-ip": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.2" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 1);
  assert.match(response.headers.get("Set-Cookie"), /^__Secure-portfolio_admin=/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(seen[0].url.href, "https://fixed-upstream.example.test/api/admin/me");
  assert.equal(seen[0].options.headers.get("cookie"), cookie);
  assert.equal(seen[0].options.headers.get("authorization"), null);
  assert.equal(seen[0].options.headers.get("x-admin-client-ip"), "192.0.2.2");
  assert.equal(seen[0].options.redirect, "manual");
  assert.equal((await nativeFetch(base + "/?__admin_path=../outside")).status, 404);
  assert.equal(seen.length, 1);
  redirects = true;
  assert.equal((await nativeFetch(base + "/?__admin_path=me")).status, 503);
});
