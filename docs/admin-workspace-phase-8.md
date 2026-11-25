# Phase 8 private workspace

The protected route guard mounts one lazy workspace shell after session verification. The shell owns the sidebar, mobile drawer, breadcrumb, skip link, main landmark and sign-out control. Feature modules render into the same outlet and keep their existing data hooks. The collapsed sidebar preference is the only new browser storage. The drawer uses native dialog semantics and closes on selection, Escape, backdrop interaction, history changes, or a return to desktop width.

## Routes and composition

`src/routes/workspace.js` is the source for protected route matching, navigation groups, active states, breadcrumbs and record links. Existing Bookings, Support Payments and financial aliases remain valid. AI views use the `view` parameter on `/admin/chats`, with Overview as the default. Unknown paths, including the retired ML page, reach a protected not-found page. The link back to the public Portfolio lives in the log-in header and workspace navigation. A separate command palette was omitted because sidebar and drawer navigation already cover the workspace destinations.

- **Overview** leads with current accounts, unread messages, seven-day recorded payment amount and conversations. Selected-period registration and inbox charts sit beside the operational status and canonical recent activity. The seven-day AI/Finance details and lower business summaries retain their original reporting definitions.
- **AI Intelligence** uses addressable views, a desktop conversation split and full-width mobile transcript. Each turn has a recorded timestamp and expandable technical metadata. Quota, cooldown, cache and retention views retain the existing observations.
- **Finance** separates the core registries from receipt, webhook, reconciliation and legacy diagnostics. Monetary tables use exact recorded values and a right-aligned amount column. The transaction inspector groups identity, amount, customer and service, lifecycle, booking, receipt and webhook observations. Missing timestamps and refunds have no inferred values.
- **Business** uses a dedicated inbox, initials in the user directory, user-related record tabs, newsletter snapshot figures, a blog article index and an activity index grouped by Asia/Kolkata date. Contacts opening, copy actions and the existing external email handoff preserve stored message state.
- **Security and system** distinguish audit history from current sessions, retain explicit current-session and revoke-all confirmations, and display actual dependency status and read-only configuration. Settings links to session management and health.
- **Sign-in** uses an editorial masthead and one form. Autofill, password visibility, exact password handling, duplicate-submit protection, throttling errors and safe return routes use the existing authentication implementation.

Workspace surfaces, type and controls retain the Monograph contract from `37a9fba56e79119dbb3236bc975103f84f8cf46c`. The latest reviewed Portfolio source, `c4f05738ec26dc4156d220a4d0368b41533edb4d`, changes motion for the public dock only. Shared tokens, UI sources and font assets match the pinned revision. Schema and corpus content were verified against the latest source, so existing provenance pins are preserved.

## Release gates for Phase 9

- Run a controlled React Router upgrade to a patched 7.x release, at least 7.18.0 for the two known advisories, and rerun protected routing, optional IDs, intended destinations, history, reloads and not-found behavior. The npm audit proposes `react-router-dom@7.18.7`, which supports React 18+ and Node 20+.
- The npm audit proposes `vite@8.3.8` for the Vite and esbuild development findings. It needs Node `^20.19.0 || >=22.12.0`, while the installed React plugin 4.7.0 declares Vite peers only through 7.x. Resolve the matching plugin, confirm the Vercel build runtime, and exercise development and production proxy behavior and the build output before rollout.
- Verify the authorized production read-only path, including Portfolio and chat collection visibility, Admin audit find access, proxy admission, cookie and CSRF behavior, Safari or real-device coverage, and representative production query plans and data. Record release and rollback steps, then deploy only with explicit approval.

Run `npm run test:workspace` for route matching and compatibility checks. `npm run test:design`, `npm run check:design`, the server suite, source contract checks, production build and isolated browser checks are the Phase 8 verification commands. No new runtime dependencies, backend changes, or environment settings are required.
