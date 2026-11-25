# Admin V2 release runbook

## Setup and required configuration

Use Node 22.12+ on the 22.x line or 24.x for the frontend and Function. The Express backend requires Node 22 or later. Install from the two lockfiles with `npm ci` and `npm --prefix server ci`. Verify the actual hosting settings and native Argon2 installation on the paired staging deploy.

| Host | Required settings |
| --- | --- |
| Vercel | Repository root, `npm run build`, `dist`, same-origin `/api/admin` rewrite to the Node Function before the SPA rewrite. Set server-only `ADMIN_API_UPSTREAM` to the exact Render HTTPS origin and set `ADMIN_PROXY_SECRET`. Use separate Preview settings scoped to the staging pair. |
| Render | Root `server` or equivalent commands, `npm ci`, `npm start`, platform-supplied `PORT`, and health check `/ready`. Set `NODE_ENV=production`, `FRONTEND_URL` to the exact Admin frontend origin, `READ_ONLY_MODE=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and the matching `ADMIN_PROXY_SECRET`. |
| Atlas | Set `PORTFOLIO_MONGODB_URI` and `PORTFOLIO_DB_NAME` for the confirmed primary database. Set `CHAT_MONGODB_URI` for `portfolio_chat` and `ADMIN_MONGODB_URI` plus `ADMIN_DB_NAME` for the dedicated security database. Grant shared data read-only access. |

Use the [authentication guide](admin-auth-phase-3.md) for exact Admin indexes, scoped permissions, and interactive owner credential setup. The runtime needs `find` on `admin_security_audit`. Use separate credentials and authorized name-only collection visibility. Verify chat access to `chat_turns`, `chat_rate`, `chat_cache`, and `chat_locks` for the full AI operations experience. Keep the proxy secret and owner password hash out of browser variables, logs, and release evidence.

## Mandatory pre-merge checklist

- [ ] **Source and dependencies.** Fetch both branches. Verify ancestry, expected divergence, clean worktree, no unintended tracked artifacts, and an unchanged Portfolio checkout. Reproduce both lockfile installs and check frontend, production-only frontend, and backend audits.
- [ ] **Automated checks.** Start a disposable MongoDB instance on `127.0.0.1:39173` and set `RUN_ADMIN_MONGO_TEST=1` for `npm --prefix server test`. Require zero skips. Run `npm run test:workspace`, `npm run test:design`, `npm run check:design`, `npm run build`, and `git diff --check`. Run Portfolio schema verification against the latest source and verify corpus and design provenance against their pinned source. Compare newer corpus and design content when the latest revision differs.
- [ ] **Browser checks.** Test sign-in, all feature routes, session expiry and revocation, deep-link refresh, and responsive layouts on the build. Check keyboard operation, reduced motion, 200% zoom-equivalent reflow, automated accessibility, and Safari or WebKit coverage. Record the actual browser and device tested.
- [ ] **Atlas.** Verify the three database identities, required collections and Admin indexes, exact runtime role scopes, and audit history read access. Run `npm --prefix server run inspect:db -- --confirm-read-only` only from a correctly configured inspection environment with authorized read-only business and chat credentials. Investigate missing or denied results. Check representative plans with bounded read-only explains, using execution statistics only where necessary. Never add shared indexes as part of the release.
- [ ] **Hosting and staging.** Verify both projects' repository, production branch, runtime, settings, deployment permissions, and auto-deploy behavior. Against an existing isolated Vercel and Render pair, verify HTTPS login, Secure/HttpOnly/SameSite cookies, session restore and revocation, CSRF, direct backend admission, no-store API responses, protected deep links, read-only endpoints, and dependency degradation. Keep preview credentials, sessions, and origins separate.
- [ ] **Recovery.** Record the tested Git SHA, current main SHA, existing Vercel and Render deployment IDs, runtime versions, configuration references, and how to restrict access. Confirm the paired cutover and rollback can be performed with existing access. Leave unknown or failed checks open and keep main unchanged until the required gates pass.

## Paired cutover and smoke test

1. Fetch again and confirm the exact tested commit and current main ancestry. Follow the repository's merge protections. Preserve the feature branch.
2. Coordinate a restricted-access window before a merge that triggers production deployment. Verify both deploy the reviewed main revision, including the Vercel Function and Render environment. Keep the previous images recoverable. The legacy bearer API and V2 cookie API require matching frontend and backend versions.
3. Check Render liveness and `/ready`, then verify direct backend rejection for private endpoints. Check the frontend deep link and same-origin `/api/admin/me` response. Verify an unauthenticated request returns JSON 401 with no-store, then use an owner-controlled login to confirm session restoration, cookie attributes, CSRF, and logout.
4. Check every module using existing records and verify chat, primary data, and the Admin audit collection independently. Perform revocation only against a release test session. Record statuses and sanitized counts, omitting private data from evidence.
5. After post-release checks pass, retire `ADMIN_PASSWORD`, `JWT_SECRET` and `VITE_API_URL` through approved environment changes. Keep compatible recovery information in the hosting secret store.

## Recovery

Restrict administrator access if authentication, proxy routing, or dependency readiness fails. Prefer a small forward fix. If rollback is required, restore the recorded Vercel and Render deployments together with their matching configuration while access remains restricted. Keep legacy bearer endpoints inaccessible to the public during recovery. Verify the protected path and dependency states before reopening access. Leave business and chatbot data unchanged.
