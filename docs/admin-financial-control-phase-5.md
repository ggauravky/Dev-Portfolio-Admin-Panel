# Phase 5 financial control center

The Admin reads financial records from the configured Portfolio primary database using the existing connection and the Phase 3 owner session. The Portfolio at `105ca84ee854336df6a90c545c8d65e65210b930` defines the schema and owns checkout, payment verification, webhook processing, receipt identity, bookings, activity and email. Phase 2 schema fingerprints are unchanged.

## Collections and write ownership

| Collection | Admin use |
| --- | --- |
| `paymenttransactions` | Canonical Razorpay service and monetary support transactions, amounts, lifecycle, receipt identity and two email delivery channels |
| `bookings` | Recorded service bookings, requested dates and times, stored reconciliation fields and relationship diagnostics |
| `paymentwebhookevents` | One recorded event per gateway event ID, with independent processing state and optional transaction reference |
| `supportpayments` | Optional historical records from the former Cashfree implementation, with original recorded provider and amount in major units. Currency and historical mode are unknown. |

The Portfolio validates gateway evidence and persists paid state before all finalization work is complete. It generates the receipt identity, creates or finds the service booking by exact order ID, persists the transaction backlink, records activity, and queues the email workflows. Support finalization skips the booking. Blog support is a separate, non-monetary engagement relationship. Admin access does not invoke any of these write paths, the provider API, or email transport.

Booking relations prefer `PaymentTransaction.bookingId`. When the backlink is absent, matching exact Razorpay order or payment IDs is permitted. An absent explicit target, conflicting identifiers, conflicting backlink, or multiple matches requires review. Customer identity, amount, and timing are never relationship keys. Historical non-Razorpay bookings without a Razorpay match are legitimate legacy records. Upcoming dates and times are customer preferences. The booking review view scans up to 200 records in its selected scope.

## API and UI

All methods listed below are authenticated `GET` under `/api/admin`. Financial writes are denied even when the global read-only switch is off. Responses use `Cache-Control: no-store`. Lists use `{ success, data: { items, total, page, pageSize, totalPages, dates }, ... }` and retain the applicable compatibility aliases. Record detail endpoints return a projected object. Analytics and reconciliation return `{ success, data }`.

| Path | Purpose |
| --- | --- |
| `/transactions` and `/transactions/:id` | Razorpay registry and transaction lifecycle inspector |
| `/bookings` and `/bookings/:id` | Recorded, paid, upcoming, historical and link-review booking scopes |
| `/support-payments` and `/support-payments/:id` | Same canonical transaction contract, constrained to monetary support |
| `/receipts` and `/receipts/:id` | Receipt identity, independent customer/admin email states and diagnostics |
| `/webhook-events` and `/webhook-events/:id` | Event status/type and exact event ID filters, event metadata and transaction link |
| `/financial-reconciliation` | Bounded diagnostic findings by record type, issue and severity |
| `/legacy-payments` and `/legacy-payments/:id` | Separate historical registry, with an explicit unavailable response if the collection is absent or unreadable |
| `/financial-analytics` | Independent transactions, bookings and webhook sections |
| `/stats` | Compact seven-day financial snapshot alongside existing dashboard sections. Compatibility booking and support counters now use that same seven-day window and the relevant date basis. |

The protected UI starts at `/admin/financial`. Existing `/admin/bookings` and `/admin/support-payments` links remain valid, including direct inspector links. List sort orders use `_id` for ties. Page size is limited to 100 items and offsets to 10,000. Registry searches escape free-text names and service terms. Current transaction emails and recognized references use complete exact matches. The default registry searches 30 days. A webhook list scoped to a valid transaction ID may request all dates with bounded pagination. Queries use a two-second MongoDB server execution limit. Analytics caches bounded query keys for 30 seconds within each Admin process. Missing sources and timeouts are reported explicitly, and independent report sections can still succeed.

## Reporting definitions

- Reporting follows Asia/Kolkata, with UTC storage and a half-open query window. Today, trailing seven or 30 calendar days, current month and custom inclusive date inputs are available. Custom inputs can cover at most 180 calendar days. Paid bookings use `paidAt`, while recorded bookings use `createdAt` and upcoming bookings use `preferredDate`.
- Attempt, pending, authorized, failed, refunded-state and email-failure counts use transaction `createdAt` and current recorded state. Currently paid counts and amount sums use `status=paid` and recorded `paidAt`. Neither cohort reconstructs past state transitions. Webhook counts use webhook `createdAt` and stand alone.
- The monetary aggregate uses validated integer INR `amountPaise`. A record must contain an integer that meets the Portfolio minimum and safe integer limit, with a matching finite rupee amount. Invalid, inconsistent or other-currency records remain visible in counts and diagnostics and are excluded from INR sums. MongoDB sums minor units as Decimal128, the API sends digit strings, and the UI formats directly from integer paise. Paid bookings and historical support never contribute amounts to Razorpay totals.
- The current schema has no authoritative per-transaction test/live mode. The mode derived from currently configured Razorpay keys describes only the current gateway configuration. All historical modes remain unverified. The `refunded` state supports counts only. Refund amounts and net revenue are `null`. Settlements, fees, taxes and profit are unavailable.

## Operational diagnostics

The receipt inspector reports stored receipt identity and timestamps. A `sent` state reflects the Portfolio's send record. Verified inbox delivery and read telemetry are unavailable. Customer receipt and Admin notification state, attempts, claim and send timestamps are independent. The Portfolio claim window is five minutes. No PDF is fetched or generated by Admin. The owner-authenticated Portfolio download endpoint records activity. Future Admin PDF access would need a Portfolio-owned, explicitly authorized endpoint and a scoped binary response path.

Webhook successes, failures, ignored events and claims are independent records. The Admin shows safe static descriptions and withholds raw errors, payloads and signatures. Record creation and update timestamps can span retries, so no gateway-latency estimate is presented.

Reconciliation reads up to 200 records from one selected collection and bounds the relationship and duplicate lookups. It reports monetary discrepancies, invalid or conflicting links, missing paid timestamps and receipt identities, inconsistent delivery fields, stale claim observations, duplicate exact identifiers and missing required fields. Recent incomplete paid finalization may be informational. The Admin uses a five-minute grace period informed by the Portfolio claim rules, with no guarantee that all finalization completes in that window. Findings describe the observed evidence. No reconciliation is run by the dashboard and no repair is performed.

## Deployment and follow-up

Phase 5 introduces no environment keys, dependencies, database migrations or index changes. The existing Admin primary MongoDB identity needs read access to the three canonical collections and collection visibility for availability detection. Legacy visibility additionally requires permission to read `supportpayments` if present. Admin session and audit storage retain their existing isolated write permissions. Production Atlas collection existence, permissions, representative query plans and live data accuracy require separate authorized verification. For future verification, the Portfolio would need to record trusted per-transaction mode at creation and authoritative refund IDs, amounts, currency and timestamps from the provider.

If Atlas execution plans show collection scans or blocking sorts, review these index candidates with the Portfolio owner before creating them:

| Collection | Index keys | Intended query |
| --- | --- | --- |
| `paymenttransactions` | `{ provider: 1, createdAt: -1, _id: -1 }` | Attempt cohorts and default transaction registry ordering |
| `paymenttransactions` | `{ provider: 1, status: 1, paidAt: -1, _id: -1 }` | Currently paid date cohort |
| `paymentwebhookevents` | `{ provider: 1, transactionId: 1, createdAt: -1, _id: -1 }` | Recent and paginated linked webhook events |

The frontend production audit reports two moderate React Router advisories, patched in React Router 7.18.0. Finance navigation is assembled from fixed paths and validated ObjectIds. The application uses declarative browser routing, which the hydration advisory lists as outside its affected configurations. Review return paths and direct links during a coordinated upgrade to a patched React Router 7 release, then repeat auth and financial workflow checks. [Open redirect advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) · [SSR hydration advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg)

The full frontend audit also flags Vite at high severity and esbuild at moderate severity as development dependencies. Keep the Vite development server on loopback while reviewing the tooling upgrade separately. The backend audit reports zero vulnerabilities.
