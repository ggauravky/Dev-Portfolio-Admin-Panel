# Phase 7 Monograph foundation

Monograph comes from the Portfolio at `37a9fba56e79119dbb3236bc975103f84f8cf46c`. The latest Signature decisions govern typography and interaction. The Admin uses the owner's Fraunces wordmark and original favicon, with a private-workspace designation and a link to the Portfolio. The private indexing policy is also explicit in the HTML.

## Migration inventory

The previous UI combined light panels, white cards, blue glass navigation, teal form controls, a cyan and indigo login, and feature-specific charts. Finance imported Chat styling, and Business imported both Chat and Finance helpers. Phase 7 applied the same foundation to the login and auth states, dashboard, AI views and conversation inspector, Finance and every registry and inspector, Business views, Security, System, and Settings. It removed the decorative blobs, pulse and shake animations, gradients, light panels and cross-feature styling imports.

## Tokens and typography

| Role | Source value |
| --- | --- |
| Ink and raised ink | `#0E0D0B` and `#161512` |
| Hairline | `#2A2824` |
| Paper and muted | `#EDEAE3` and `#9C978C` |
| Accent and resting accent outline | `#C6F432` and `#4E5E19` |
| Structural, control, dialog radius | `0`, `4px`, `8px` |
| Spacing | `8`, `16`, `24`, `32`, `48`, `64`, `96`, `128px` |
| Motion | `160`, `280`, `520ms` with `cubic-bezier(.22, 1, .36, 1)` |

Tokens are RGB channels in `src/styles/tokens.css`, with Tailwind 3 aliases that support opacity modifiers. The Admin adds a warm, contrast-checked control boundary, semantic text tones for error, warning and success, and warm chart series. There is one dialog shadow. Decorative hairlines separate content and the stronger boundary identifies form controls.

Fraunces serves editorial headings and selected financial figures. The Admin uses a 32–44px page title scale instead of the public hero scale. Geist is the reading and control face. Geist Mono and tabular numerals identify references, timestamps, and numeric columns. Original Latin-subset variable fonts, optical sizing, fallback metrics, and SIL OFL notices are preserved. Geist regular is the only preload. Glyphs outside those Unicode subsets, including INR, use installed fallbacks. Financial formatting continues to use exact minor-unit strings.

## Shared components and interaction

- `components/ui` provides outlined primary and secondary buttons, link and ghost treatments, destructive actions, labeled fields, status tags, an editorial header and rule, alerts, and the skip link. Primary controls use a paper label and muted-accent border at rest, with a lime outline and an underline on hover or focus.
- `components/data` provides tables, record fields, filters, date controls, pagination, metrics and charts independent of the feature modules. Tables keep semantic headers and captions and scroll inside a focusable region at narrow widths. Monetary columns align right. Chart series use warm neutrals and a labeled warning series, with tick labels and tabular alternatives. Missing values are absent from plots and marked unavailable in their tables.
- `hooks/useResource.js` preserves the previous cancellation, debounce and stale-response checks. Protected feature bundles are requested when an authenticated route opens. The SPA, API proxying, route paths, auth semantics, and business contracts carry forward.
- Session confirmation uses native modal behavior for inert background content and keyboard handling, plus explicit initial and returned focus and a page scroll lock. Current-session and revoke-all still require confirmation. The drawer treatment is available for the later navigation work. Reduced motion collapses transitions globally. Mobile controls use a 44px minimum where appropriate.

The Admin keeps the existing page composition and avoids the public dock, custom cursor, magnetic controls, hero reveals, and route wipe. Panels are square with hairlines and use the raised ink surface. The public site's grain overlay is omitted from dense data views. The existing top navigation remains scrollable on mobile.

At the Phase 7 production build, the initial JavaScript entry was 181.44 kB raw and 59.27 kB gzip, down from 268.87 kB and 80.97 kB. All route chunks together total 262.80 kB raw and 87.46 kB gzip. CSS went from 26.18 kB raw and 5.57 kB gzip to 21.01 kB and 5.33 kB. The four WOFF2 files total 150.84 kB and load according to font use.

## Verification and synchronization

Run `npm run test:design` for checker tests and `npm run check:design` for offline checks. The checker looks for legacy Tailwind palettes, gradients, blur and motion patterns, unsupported shadows and radii, and literal colors outside the token sheet. It also checks asset fingerprints and WCAG contrast thresholds for text and meaningful control and chart boundaries. The source revision, canonical tokens and original assets are pinned in `scripts/monograph-contract.json`.

To synchronize a later Portfolio revision, inspect its design decisions and source, update only the intended shared tokens and assets, and regenerate the pinned values. Use `npm run check:design -- --portfolio <checkout>` to verify an existing clean local source checkout. Compare the rendered Admin and Portfolio, and rerun the responsive and auth flows with isolated fixtures. Normal builds need no source checkout or network font requests.

The React Router 6.30.6 production advisories and Vite 5.4.21/esbuild 0.21.5 development findings remain release work. The audit proposes React Router DOM 7.18.7 and Vite 8.3.8, both major upgrades. Handle them in a controlled change that checks the Node and Vercel runtimes, the React plugin, optional and nested routes, auth and intended destinations, history, reloads, and the Vite/Vercel API proxies. Keep local tooling loopback-only. [React Router open redirect advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) · [React Router SSR advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg) · [Vite advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) · [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)

## Phase 8 scope

Use this foundation for the persistent responsive sidebar and mobile navigation, final dashboard layout and editorial login, AI and Finance workspaces, business modules, and record inspectors. Finish with responsive and accessibility review of each page composition.
