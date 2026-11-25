# Administrator authentication and rollout

Phase 3 uses a single configured administrator, Argon2id, and MongoDB-backed opaque sessions. Portfolio Google credentials have no Admin privileges. The Admin browser uses same-origin `/api/admin`. Vercel rewrites those requests to the dedicated Node Function before the SPA route. The Function talks to a configured HTTPS Render origin and forwards only its scoped cookie, selected request headers and bounded JSON. It authenticates to Render with a separate shared secret, rejects upstream redirects and disables caching. Vite provides an equivalent localhost proxy for development and preview.

## Configuration

Use Node 22.12+ on the 22.x line or 24.x on Vercel. Render's backend manifest requires Node 22 or later. Use the same supported LTS line on both hosts where possible. Local backend values go in ignored `server/.env`. Production secrets go in each service's server-only environment settings.

| Variable | Runtime | Requirement |
| --- | --- | --- |
| `ADMIN_EMAIL` | Backend | Required. Normalized configured owner email. |
| `ADMIN_PASSWORD_HASH` | Backend | Required. Generate through the interactive command. Only the supported Argon2id encoding is accepted. |
| `PORTFOLIO_MONGODB_URI` and `PORTFOLIO_DB_NAME` | Backend | Use the Portfolio read-only credential and set the database name explicitly to `test`. A database path in the URI must match. |
| `CHAT_MONGODB_URI` | Backend | Use the chatbot read-only credential. Admin selects `portfolio_chat` automatically. |
| `ADMIN_MONGODB_URI` | Backend | Use a different Atlas username scoped to the three Admin security collections. A database path in the URI must match the selected database. |
| `ADMIN_DB_NAME` | Backend | Optional. Defaults to the Portfolio database. Omit for Cluster0. Existing separate security databases can still set their own name explicitly. |
| `ADMIN_PROXY_SECRET` | Render and Vercel Function | Required in production on both services. Generate once and set the same 32-byte hex value on both. Development uses loopback and an exact origin check. |
| `ADMIN_API_UPSTREAM` | Vercel Function | Required. Fixed HTTPS origin of the matching Render service. Omit paths and credentials. Preview must point to isolated infrastructure and use separate secrets. |
| `FRONTEND_URL` or `ADMIN_ALLOWED_ORIGINS` | Backend | Required in production. Exact HTTPS browser origins. Set the Vite URL explicitly for non-default local origins. |
| `ADMIN_SESSION_IDLE_MINUTES` | Backend | Optional, 30 minutes by default, range 5–120. |
| `ADMIN_SESSION_MAX_HOURS` | Backend | Optional, 12 hours by default, range 1–24. |
| `ADMIN_AUDIT_RETENTION_DAYS` | Backend | Optional, 90 days by default, range 7–365. Applies to new events. |
| `ADMIN_DEV_PORT` | Vite process | Optional loopback backend port, default 5000. |

Use one primary URI setting for V2. If the legacy `MONGO_URI` is also configured, it must exactly match `PORTFOLIO_MONGODB_URI`. Keep secrets server-only. Retire the legacy `ADMIN_PASSWORD`, `JWT_SECRET` and `VITE_API_URL` after the paired cutover is verified.

## Owner credentials and recovery

Run `npm --prefix server run auth:credential` from a local interactive terminal for initial setup or rotation. The prompt hides and confirms the exact password, including whitespace. It accepts 14 or more characters and up to 256 UTF-8 bytes. The command writes only the generated hash into a new private file under your own profile directory and prints the file location. Copy the hash into the backend secret settings without quoting or changing it. Remove the temporary file once stored. On Windows, use a private OS user profile with inherited owner-only access. Run `npm --prefix server run auth:credential -- --proxy-secret` separately for the Vercel/Render shared secret.

Owner recovery uses the same command and trusted Render console access. Updating the hash invalidates prior cookies and sessions on instances running the new configuration. Wait for all old instances to drain before treating rotation as complete. The first successful sign-in with a credential version records a credential-observed event. The hash and version material are excluded from returned session data.

## Admin MongoDB bootstrap

Before enabling Admin V2, load a temporary operator URI for Cluster0 into the local process environment as `ADMIN_PROVISION_MONGODB_URI`. Give that operator `listCollections` on `test` and `createCollection`, `createIndex`, `listIndexes`, and `find` on the three security collections. Run from the Admin repository:

```sh
npm --prefix server run auth:provision -- --database test
```

The command checks that the explicitly selected database already contains a recognized Portfolio collection. It creates only the three Admin collections and six required indexes. Reruns reuse compatible indexes, including custom index names. A conflict or a populated security collection missing its TTL index stops provisioning. MongoDB TTL indexes can expire stored records, so run this before enabling the Admin service. Clear the temporary URI from your shell when finished. The application verifies indexes at connection time.

| Runtime collection privilege | Actions |
| --- | --- |
| `admin_sessions` | `find`, `insert`, `update`, `listIndexes` |
| `admin_auth_limits` | `insert`, `update`, `listIndexes` |
| `admin_security_audit` | `find`, `insert`, `listIndexes` |

Use an Atlas custom role scoped to these exact collection names on `test`. The security runtime needs these actions and authorized name-only collection visibility. Give the Portfolio runtime account `find` on its business collections in `test` and the chat runtime account `find` on `chat_turns`, `chat_rate`, `chat_cache`, and `chat_locks` in `portfolio_chat`. All three connections keep independent clients and permissions. TTL cleanup runs on MongoDB for Admin security records.

## HTTP behavior

| Method and path under `/api/admin` | Behavior |
| --- | --- |
| `POST /login` | Exact trusted origin and bounded JSON. Verifies credentials, rotates an existing session and sets a new cookie. |
| `GET /me` | Returns administrator identity, expirations, capability flags, and a CSRF token for in-memory use. |
| `POST /logout` | Exact origin and CSRF for active sessions. Revokes the session and clears the cookie. Already expired sessions can be cleared. |
| `GET /sessions` | Lists active session IDs and timestamps, up to 100. |
| `DELETE /sessions/:id` | Revokes the selected session. |
| `POST /sessions/revoke-others`, `POST /sessions/revoke-all` | Revoke other sessions or all sessions, respectively. |

The cookie is host-only, HttpOnly, SameSite Strict, scoped to `/api/admin` and Secure in production. It expires at the absolute deadline. CSRF tokens bind to the current opaque session, and authenticated security mutations require a trusted Origin and the token. Business writes stay disabled. Session verification checks idle, absolute and revoked state in MongoDB. Activity is extended at most once a minute. Session or rate-store failure returns 503; the frontend distinguishes outages from 401 expiry.

Login uses atomic shared five-minute windows: eight attempts per network, twenty for the single account, and sixty admitted attempts globally. Two concurrent Argon2 operations per process cap memory use. Limit rejection returns 429 with `Retry-After`. Distributed abuse can temporarily exhaust a window. Rate and authorization audit rejection records are sampled, while credential decisions and security mutations have explicit audit events. A successful login requires a stored audit event before releasing a cookie. Revocation records its intent before writing, then attempts to record completion. On completion-audit failure the revocation stands and a sanitized operational event is logged.

## Rollout and rollback

1. Confirm the backend database identities and provision the Admin security collections in the existing Portfolio database using an operator credential. Configure secrets on the paired services. Keep the existing deployment available for independent recovery.
2. Test an isolated Render/Vercel pair end to end, including allowlisted exact origins, HTTPS cookies, revocation, old bearer-token rejection, same-origin paths, and frontend restoration after refresh.
3. Roll out the paired frontend and backend together so there is no lasting mismatch in response and authentication formats. Require all administrators to sign in again. Remove obsolete variables from the services once the migration is confirmed.
4. If verification fails, keep the portal unavailable or roll back together under restricted access while repairing configuration. Restoring the old backend reintroduces bearer authentication. Do not expose that rollback publicly with the old signing key still valid.
5. Validate `/ready`, protected 401s without cookies, login and logout, current data reads, and Admin audit writes after cutover. Leave the business databases unchanged.

Local testing proves the app and browser behavior through Vite. The deployed Vercel Function routing and Render/Atlas credential policy require separate infrastructure verification.
