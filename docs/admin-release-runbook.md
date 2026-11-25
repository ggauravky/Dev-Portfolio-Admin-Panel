# Admin release runbook

## Architecture

```
Visitor → Portfolio website/backend ──writes──▶ MongoDB cluster0
                                                ├─ test            (contacts, users, bookings, paymenttransactions, …)
                                                └─ portfolio_chat  (chat_turns, chat_cache, chat_rate, chat_locks)

Owner → ggauravkyadmin.vercel.app ──/api/admin/*──▶ Vercel function api/admin-proxy.js
        (adds ADMIN_PROXY_SECRET, forwards only the admin cookie)
      → Render: dev-portfolio-admin-panel.onrender.com ──reads only──▶ test + portfolio_chat
        (one MongoClient from MONGO_URI serves both databases)
```

The Admin never writes to MongoDB. Read-only access is enforced by the application (no write
routes, no write calls; `server/tests/retired-routes.test.js` checks this). The existing Mongo
user may have broader database rights, so MongoDB itself does not enforce read-only access.

## Authentication

- One administrator: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (Argon2id) or the legacy `ADMIN_PASSWORD`
  (hashed in memory with Argon2id at first sign-in).
- Session: HMAC-SHA256 signed cookie `__Secure-portfolio_admin` (HttpOnly, Secure, SameSite=Strict,
  Path=/api/admin), fixed lifetime `ADMIN_SESSION_MAX_HOURS` (default 8). Nothing is stored in MongoDB.
- Logout requires the CSRF token and clears the cookie in this browser. A copied cookie stays valid until
  it expires. To end every session immediately, change `JWT_SECRET` (or `ADMIN_SESSION_SECRET`) or the password on Render.
- Login rate limit is held in process memory: it resets when Render restarts the service.
- Security events go to Render logs only. There is no persistent audit history.

## Environment

| Platform | Variable | Value | Status |
|---|---|---|---|
| Render | `MONGO_URI` | existing Portfolio connection string | existing |
| Render | `ADMIN_EMAIL` | administrator email | existing |
| Render | `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` | password, or hash from `npm --prefix server run auth:credential` | existing / optional upgrade |
| Render | `JWT_SECRET` | existing (≥ 32 characters), used as the session signing secret | existing |
| Render | `FRONTEND_URL` | `https://ggauravkyadmin.vercel.app` | existing |
| Render | `NODE_ENV` | `production` | existing |
| Render | `ADMIN_PROXY_SECRET` | 64 hex characters | new |
| Vercel | `ADMIN_API_UPSTREAM` | `https://dev-portfolio-admin-panel.onrender.com` | new |
| Vercel | `ADMIN_PROXY_SECRET` | same value as Render | new |

No longer used (remove after a successful release): `READ_ONLY_MODE` (Render), `VITE_API_URL` (Vercel),
and the V2-draft `ADMIN_MONGODB_URI`, `ADMIN_DB_NAME`, `ADMIN_SESSION_IDLE_MINUTES`, `ADMIN_AUDIT_RETENTION_DAYS`.
Generate the proxy secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Checks

```
npm --prefix server test                        # set RUN_ADMIN_MONGO_TEST=1 with a disposable mongod on 127.0.0.1:39173
npm run test:workspace && npm run test:design && npm run check:design && npm run build
npm --prefix server run inspect:db -- --confirm-read-only   # sanitized counts against the real databases
git diff --check
```

## Release and rollback

1. Set the new variables on Render and Vercel (Production).
2. Merge `feat/admin-v2-overhaul` into `main` and push. Render and Vercel deploy `main` automatically.
3. Verify: `https://dev-portfolio-admin-panel.onrender.com/` returns `status: ok`;
   `https://ggauravkyadmin.vercel.app/api/admin/me` returns 401; sign in and open each workspace.
4. Rollback: `git revert -m 1 <merge commit>` on `main` and push, or redeploy the previous deployment
   from the Render and Vercel dashboards. The previous version still uses the existing variables.
