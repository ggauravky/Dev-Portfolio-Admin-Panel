# Phase 4 AI Intelligence

The Admin reads the existing Portfolio chatbot's stored data through the Phase 2 chat connection and Phase 3 session and proxy checks. The reviewed Admin base was `5da2470`. The Portfolio checkout at `105ca84ee854336df6a90c545c8d65e65210b930` matched every previously pinned schema and write-path fingerprint. The contract revision was advanced after that comparison. Production configuration and its deployed corpus have not been inspected.

## Source evidence and data boundaries

The public chat function validates the request, checks visitor admission and quotas, then may use a fixed answer, cached answer, FAQ, retrieval with Groq or Gemini, or a grounded template. The handler writes a turn after processing an answer. Invalid input, busy and rate-limited requests, early aborts and storage outages need not leave a durable row. The Mongo store can fall back to process-local state. The provider column describes the recorded answer. A cached provider label, multiple calls in one answer, a failed provider retry, and a template fallback make it unsuitable for counting actual provider API calls.

The application log can hold routing reasons, cache decisions, retry/cooldown events, validation flags, citation counts, and emergency fallback information. These are outside the durable turn contract. The Admin never calls an AI provider. It has no provider credentials.

## API and privacy

All paths below are GET and use existing Admin session validation, proxy boundaries, request IDs and no-store headers.

| Endpoint | Description |
| --- | --- |
| `/api/admin/chats` | Turn page. Retains the `chats` and `total` aliases alongside the pagination envelope. |
| `/api/admin/chats/:id` | Projected turn by UUID. Preserves the root response shape. |
| `/api/admin/chat-conversations` | Paginated grouped summaries over matching turns, ordered by last matching turn time. |
| `/api/admin/chat-conversations/:reference` | Chronological pages for one grouped context in the selected date range. |
| `/api/admin/chat-analytics` | Separately available volume and latency sections. |
| `/api/admin/chat-knowledge` | Paged source catalog and bounded observations of corpus versions and top retrieved chunks. |
| `/api/admin/chat-operations` | Read-only observations of known quotas, cooldowns and active cache entry count. |

Conversations group on the exact recorded session UUID and owner binding. Turns missing a valid binding or session form independent singleton groups. A group is a recorded context, and one human may have several contexts. The UUID of its first matching turn acts as an opaque Admin reference. An anchor remains usable while its turn is retained, and filters or TTL expiry can change the reference returned for a group. The API never sends raw owner bindings, session UUIDs, IP hashes, visitor IDs, quota keys, or cache payloads. Individual turns provide an anchor reference and retain question, answer and allowlisted technical fields. The UI renders text without interpreting HTML or Markdown. Conversation summaries contain at most 160 leading characters of the initial matching question.

Search is literal and escaped. Pagination is 25 by default, limited to 100 with a maximum offset of 10,000. Turn filters include validated response type, intent, retrieval mode, cache, match and abort booleans, corpus version, date range and a conversation anchor UUID. The `unknown` category preserves the distinction for historical or missing values. Original safe labels are displayed on individual records. All conversation operations are read-only.

## Metric definitions

- Today and 7/30/90-day presets include the current Asia/Kolkata calendar day. Custom bounds are both inclusive by calendar date and limited to the latest 180 calendar days. The database uses UTC timestamps with an exclusive upper bound. Daily distinct group counts are independent, so their sum can exceed the distinct count for a period.
- Cache hit rate uses only turns with a known boolean cache flag, as does the abort rate for its own flag. All-turn retrieval match rate uses known match flags. Retrieval-eligible match rate restricts the denominator to hybrid, keyword or about retrieval with a known match flag. Cache and canned/none modes are excluded from that denominator. Match is a retrieval observation.
- Recorded answer distribution includes stored Groq, Gemini, FAQ, canned, template and an unknown bucket. Local answer types count FAQ, canned and template. Declined, no-match and aborted counts are observed states. Cache hits and template answers do not establish calls saved or failed. Raw “common questions” are omitted for privacy.
- Latency is handler-recorded elapsed time. Valid finite values from 0 to under 24 hours are included, except for turns explicitly marked aborted. Average, minimum and maximum are computed in MongoDB. Median and P95 use nearest-rank counts over 50 ms buckets, returning the lower bucket edge. The 120-second overflow bucket is reported as at least 120 seconds. Daily and provider averages use the same eligibility. Empty denominators return null. A failed aggregation returns a distinct unavailable state.
- The Admin dashboard uses a compact seven-day recorded-chat summary. Its business totals do not mix with the chat window. A failed chat summary cannot replace or block valid primary metrics.

## Knowledge and operational access

The sanitized manifest uses the pinned Portfolio repository corpus `ccbaded070c8edc8` with 324 chunks, Gemini embedding metadata and 768 dimensions. It contains public titles and metadata only. Links are allowed for the Portfolio and verified owner GitHub namespace. Unsafe or unverified URLs are omitted. Historical source titles and links are available only when the turn's corpus version matches the manifest and the ID exists. Retrieved chunks do not establish citations.

Verify with `npm --prefix server run verify:chat-manifest -- /path/to/Dev-Portfolio --check`. The generator reads the committed corpus from the given checkout. Run without `--check` to generate a reviewable sanitized snapshot. Use the existing schema contract command to identify upstream changes in the write paths and quota configuration. Do not copy embeddings, source document text, profiles or example questions.

The normal Admin chat credential needs read access to `portfolio_chat.chat_turns`. Optional operational rows require read permission on `chat_rate`, `chat_locks` and `chat_cache`. Keep the existing least-privilege credential if those observations are unnecessary. Missing visibility, authorization errors, timeouts and missing counters remain visible separately. No new environment variables are required and no privilege grants are performed by this change.

Quota windows use 60-second and UTC-day boundaries, plus 10-second generation starts. Observations use exact known application counters and recognized cooldown IDs. Counter rows expire after their reporting window, so expiry alone does not make them current. Reservations, refusals, settlements, local emergency allowances and other consumers prevent reliable external quota or remaining-budget claims. Cache status reports only an unexpired entry count. Operations are timestamped briefly cached observations, not health guarantees.

## Performance and rollout

Range scans use the chatbot's existing date index where the planner allows. Group, latency and knowledge operations have execution limits, bounded results and no disk spilling. Aggregate summary caching is private to the backend and short-lived. Requests share a per-process concurrency cap, and the browser aborts superseded requests. The app never creates or changes an index or TTL policy. If authorized production measurements show slow queries, discuss a `{createdAt: -1, _id: 1}` stable-sort index and a `{sessionId: 1, owner: 1, createdAt: 1, _id: 1}` conversation-read index with the Portfolio owner. They add write amplification and storage, and require separate approval before implementation.

The current React Router 6 release still carries two moderate advisories. The Admin builds as a client-only SPA and uses fixed navigation destinations plus a validated same-origin return path. The SSR-hydration advisory does not match this application's rendering path. The open-redirect advisory requires attacker-controlled router destinations. Inspect any future dynamic links. The patched dependency requires a separately verified React Router 7 migration.

Verify deployed Vercel/Render routing and authenticated reads with authorized Atlas credentials before production sign-off. Additional permission for operations is optional. The phase is independent of Phase 5.
