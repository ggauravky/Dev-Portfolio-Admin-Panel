# Admin API Phase 2 deployment notes

Phase 2 introduces a read-only Admin API on the existing Vercel/Render topology. The Portfolio service still owns all shared writes. No production change is required for local verification.

## Configuration

Set the backend variables in ignored `server/.env` locally and in the Admin Render service in production. Set the frontend variable in ignored root `.env` locally and on the Admin Vercel project in production. Use an isolated database for local runtime testing.

| Variable | Service | Required and fallback |
| --- | --- | --- |
| `PORTFOLIO_MONGODB_URI` | Admin backend | Required for new configuration. `MONGO_URI` is the legacy alternative. If both exist, they must match exactly. |
| `PORTFOLIO_DB_NAME` | Admin backend | Required with the canonical URI. Legacy configurations can use the URI database path. If both a path and explicit name are provided, they must match. Confirm the name with infrastructure metadata. |
| `CHAT_MONGODB_URI` | Admin backend | Optional. Explicitly selects `portfolio_chat`. Missing means chat is not configured. A conflicting URI path fails startup. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET` | Admin backend | Required. Reuse the existing owner authentication inputs until Phase 3. |
| `FRONTEND_URL`, `ADMIN_ALLOWED_ORIGINS` | Admin backend | At least one exact HTTPS origin in production. They are combined. The latter is comma-separated. Localhost development origins are enabled only outside production. |
| `NODE_ENV`, `PORT` | Admin backend | Optional locally, defaults to development and 5000. Set production mode in production. Honor the platform's injected port. |
| `READ_ONLY_MODE` | Admin backend | Optional boolean, defaults to false. Reported separately from the effective resource policy. All shared writes are disabled in Phase 2 regardless. Login remains available. |
| `DB_CONNECT_TIMEOUT_MS`, `DB_POOL_SIZE` | Admin backend | Optional, defaults to 5000 ms and 8 connections per pool. |
| `DNS_SERVERS` | Admin backend | Optional comma-separated IPs. Uses the system resolver if unset. |
| `TRUST_PROXY_HOPS` | Admin backend | Optional 0–2, defaults to 0. Set only after confirming the trusted ingress path. |
| `VITE_API_URL` | Admin frontend | Admin API base ending in `/api/admin`. Local browser fallback is the local backend. |

Use separate credentials. The primary credential needs `find` on the nine primary collections in the contract. Chat needs `find` on `chat_turns` only. The runtime verifies existing collection metadata using MongoDB's name-only, authorized-collections mode, so it needs visibility to a recognized primary collection and the chat turns collection. For inspection, the credential needs visibility to any collections being inventoried and `listIndexes` on the inspected collections. Prefer a separate inspection credential if necessary. Missing visibility is reported as ambiguous. No write, collection-creation, index-modification or quota permission is needed.

## API compatibility

`GET /` is liveness. `GET /ready` returns a minimal primary availability result. Chat is optional for readiness. Authenticated `GET /api/admin/system` reports dependency state, configuration status, and effective capabilities. Connections are independently verified and retried on demand after a cooldown. The server never issues a collection or index creation command.

Protected list responses include `data.items`, `data.total`, `data.page`, `data.pageSize`, and `data.totalPages`, plus the legacy named array and `total`. Details preserve their root payload. Sorting uses a stable ID tie breaker. Query defaults are 25 items, maximum 100, and maximum offset 10,000. Date bounds are inclusive `from` and exclusive `to`, in UTC. `totalPages` describes the reachable result window, while `total` is the actual matching count. Refine filters to inspect results beyond the offset cap. Errors include a stable code and request ID, and private responses use `no-store`.

The former booking and support delete endpoints now return 403 to authenticated clients. Contact, newsletter, and chat mutations are also disabled pending later phases. Support payments filter canonical Razorpay transactions to the support flow. Historical Cashfree collections are preserved and excluded from current metrics. Chat results use canonical turns and return 503 when storage is unavailable. Dashboard counters from unavailable sources are null. Old fallback, degraded, and latency metrics were removed until current analytics are implemented.

## Contract and inspection commands

`npm --prefix server test` runs DB-free configuration, API and contract tests.

`npm --prefix server run verify:contract -- /path/to/Dev-Portfolio` compares the checked-out source files against normalized source fingerprints alongside the machine-readable schema at `server/contracts/portfolio-schema.json`. It requires the checkout and exits nonzero on missing or changed source. It deliberately flags all changes in those files, including harmless edits, for review. When upstream changes, review fields, write paths, collection naming, permissions and compatibility before updating the snapshot and fingerprints.

`npm --prefix server run inspect:db -- --confirm-read-only` explicitly connects using configured read-only credentials. It prints aggregate counts, collection and index compatibility, sampled field types, and potential orphan counts. It reports whether the identity matches without printing database configuration. Unauthorized operations are reported as limited. Sampling is bounded and is not a full integrity scan.

Production database identity, Atlas permissions, data and index parity, proxy configuration and deployed readiness require separate authorized verification. Before rollout, retain the previous deployment as rollback and coordinate API/frontend deployment because the paginated frontend consumes the new envelope.
