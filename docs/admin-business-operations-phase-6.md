# Phase 6 business operations

> **Superseded (release):** MongoDB-backed sessions, the `admin_*` security collections, audit history and `ADMIN_MONGODB_URI` were removed. Authentication is now a stateless signed cookie and the Admin reads with the existing `MONGO_URI`. See [admin-release-runbook.md](admin-release-runbook.md).

The Admin reads the Portfolio's primary MongoDB database through its existing pools. The reviewed Portfolio revision is `37a9fba56e79119dbb3236bc975103f84f8cf46c`. The Phase 2 schema and write-path fingerprints match the earlier pinned revision. The chat manifest points to the reviewed revision with identical corpus metadata.

## Modules and relationships

| UI | Admin API GET paths | Evidence |
| --- | --- | --- |
| `/admin/users` and user detail | `/users`, `/users/:id`, `/users/:id/{activity,transactions,bookings,blog-supports}` | Portfolio Google sign-in creates or updates `users`; profile updates write selected user fields. Relations use canonical `userId` only. Historical records without it stay unlinked. Each relation has independent pagination. |
| `/admin/contacts` and message detail | `/contacts`, `/contacts/:id` | `contacts` is written by the Portfolio contact form. List responses contain a bounded preview and detail contains the full text. Opening and copying do not change status. The email-client handoff requires an explicit click. |
| `/admin/newsletter` and subscription detail | `/newsletters`, `/newsletters/:id` | `newsletters.subscribed` uses stored `true` for active and `false` for unsubscribed, matching the Portfolio's stats queries. A missing flag stays unknown. Resubscription preserves `subscribedAt` and clears `unsubscribedAt`. |
| `/admin/activity` and event detail | `/activity`, `/activity/:id` | `activityevents` is written by recorded authentication and payment workflows. Known producers are login, logout, payment success/failure and receipt download. Older action values remain visible. A transaction link needs a valid transaction ID, the same canonical owner and a Razorpay record. |
| `/admin/blog-engagement` and support views | `/blog-posts`, `/blog-posts/:id`, `/blog-supports`, `/blog-supports/:id` | `blogposts` can be created during support and contains a stored counter. `supports` contains the non-monetary user/article relationships. The Admin compares them, reports missing references and identifies historical title or slug differences. The revision-pinned article allowlist includes slugs resolved by the Portfolio's public article route. |
| `/admin/security` and audit views | `/audit-events`, `/audit-events/:id`, `/sessions` | `admin_security_audit` and `admin_sessions` are in the Admin database. Audit filters use actual producer types. The projected reference combines the request ID, type, result and timestamp to avoid exposing internal Mongo IDs with embedded credential or session references. |
| `/admin/system`, `/admin/settings` | `/system` | Policy and readiness come from validated config and existing pools. Optional collections with visible metadata receive bounded read probes. Unknown means absence and limited collection visibility cannot be distinguished. No external provider checks are performed. |
| `/admin` | `/stats`, `/business-analytics` | Business sections are independent from the existing finance and AI summaries. |

All paths are under `/api/admin`. Direct UI links and record paths are protected by the existing session and proxy middleware. Business and audit reads use explicit projections, stable sort ties, at most 100 records per page, offsets through 10,000, and two-second MongoDB query execution limits. Text search escapes regex metacharacters and bounds input length. Browser data requests abort on navigation. Profile websites are displayed as text, profile images are not loaded, and no raw provider identifiers, event keys, activity metadata, credentials, network fields, supporter snapshots or article bodies are sent.

## Reporting definitions

Reports use UTC storage and Asia/Kolkata calendar dates with half-open internal bounds. The available periods are today, seven days, 30 days, current month and custom periods up to 180 days. `generatedAt` indicates when the report was assembled. Aggregate results are briefly cached in the authenticated server process. Missing or unreadable sections are unavailable. An empty readable collection reports zero.

| Metrics | Basis |
| --- | --- |
| User counts and verified, unverified and unknown counts | Current documents and stored flags in `users`. Reported registration count and daily trend use `users.createdAt`. The last-login cohort counts records with `lastLoginAt` in the period. |
| Users with recorded activity | Distinct canonical `activityevents.userId` values with an existing user document and at least one event by `activityevents.createdAt` in the period. |
| Contacts and status distribution | Current `contacts` documents and stored status. Incoming messages and daily trend use `contacts.createdAt`. Status shares use all recorded contacts, including unknown status. The schema lacks read and reply timestamps. |
| Newsletter | Current document and flag counts. New record totals and the daily trend use `newsletters.createdAt`. The unsubscribe count uses surviving `unsubscribedAt` values in the period. The schema does not preserve unsubscribe/resubscribe history and cannot establish exact churn. |
| Blog engagement | Total current `supports` records, distinct recorded supporter IDs and indexed joins to currently stored article IDs. Rankings count support relationships per existing article. Period activity and trend use `supports.createdAt`. Unique supporter IDs may include historical references to missing accounts. |
| Activity distributions | `activityevents.createdAt` selects the period. Domain, action and status shares use all recorded events in that window, including an unclassified bucket. This is recorded workflow activity. |
| Dashboard timeline | Up to five candidates per source and at most 12 displayed. Uses creation times for user, contact, support and canonical transaction records. Payment activity and booking records are excluded from this timeline to avoid duplicate payment representations. |

The `/stats` compatibility field `totalNewsletters` counts explicit active flags. Finance keeps the Phase 5 paise, paid-date, refund and mode rules. AI keeps the Phase 4 seven-day summary. Adjusting a business report period does not change their seven-day windows or any current snapshot values.

## Access and follow-up

Business data and audit events remain read-only. Session revocation is a separate security operation. The UI calls the existing CSRF-protected single-session, revoke-others and revoke-all endpoints. Revoke-all requires confirmation. Revoking the current session clears private state and returns to sign-in. Session listings use the existing 100-session cap and only list recorded safe timestamps.

No additional environment variables, services, migrations or indexes are needed. Existing MongoDB principals need read access to the related Portfolio collections. The isolated Admin credential needs `find` on `admin_security_audit` in addition to its existing audit insertion and index verification permissions. Check collection visibility, deploy-time permissions and representative Atlas query plans before rollout. Where those plans warrant it, evaluate `{ createdAt: -1, _id: -1 }` on `users` and `newsletters`, and `{ requestId: 1, createdAt: -1 }` on `admin_security_audit`. Existing indexed user, article and activity references are used for lookup. No index was created in this phase.

A future approved contact status change could permit only validated status transitions through the existing session, CSRF and audit checks with a narrowly scoped database action. Future unsubscribe requires a consent-aware explicit action and Portfolio-owned history semantics. Neither capability is enabled.

## Dependency findings

The production frontend audit flags React Router 6.30.6. Navigation uses fixed registry routes and encoded record identifiers. The existing login return-path guard allows only normalized Admin paths. The SSR hydration advisory identifies declarative routing as outside its affected configurations. Move to a patched React Router 7 release (at least 7.18.0 for these advisories) with its supported React and Node versions, then verify protected deep links, return paths, back/forward, session expiry, logout, finance and chat navigation. [Open redirect advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) · [SSR hydration advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg)

The full audit also flags Vite 5.4.21 and transitive esbuild 0.21.5. These development-tooling findings do not ship with the static production bundle. Keep development and preview servers loopback-only, especially on Windows. The available audit fixes require a major upgrade. Review the Vite, React plugin and Node compatibility together, then verify builds, local API proxying and the deployed Vercel rewrite. [Vite development-server advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) · [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
