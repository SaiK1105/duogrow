# DuoGrow multiplatform roadmap — 2026-08-06

Context document for shipping DuoGrow to iOS, Android, and a web analytics
dashboard. This records the decomposition and the decisions behind it. Each
phase gets its own spec and implementation plan; this file is not itself an
implementation plan.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Mobile stack | **Capacitor** wrap of the existing SPA | The web UI is already phone-shaped and touch-sized. Reuses the screens, components, and API client rather than re-implementing them. |
| Release target | **Small private group** | TestFlight + Play internal testing. Removes public App Review and privacy-label work from the critical path. |
| Persistence | **Litestream → Cloudflare R2** | The only free option that requires no application code change. `better-sqlite3` is synchronous; every managed-database alternative forces an `async` refactor through every route and every server test, putting the recently hardened auth and quota code at risk. |
| Dashboard | **New analytics surface**, desktop-first | The phone UI already works in a browser. A dashboard earns its place only by showing what a phone cannot: history, trends, comparison. |

Rejected: Render persistent disk (~$7/mo, not free), Render free Postgres
(expires after 30 days), Supabase free tier (pauses after a week of inactivity),
React Native rewrite (re-implements 7 screens and ~24 components for a product
whose UI already suits phones).

## Hard external constraints

These are policy and platform limits, not engineering gaps. They cannot be
designed around.

- **Building iOS requires macOS.** Capacitor generates the Xcode project on
  Windows, but compiling and signing needs a Mac or a cloud macOS runner. The
  development machine is Windows 11.
- **TestFlight requires the Apple Developer Program at $99/year.** There is no
  free path to installing on another person's iPhone. The free-Apple-ID sideload
  expires after 7 days, covers one device at a time, and still needs a Mac.
- **Android has neither constraint.** A signed APK can be built on Windows and
  distributed directly at no cost. Play internal testing is a $25 one-time fee
  and is optional.

Consequence: iOS is designed to be *build-ready* rather than treated as a
blocker. Android ships first.

## Phases

Each phase is independently useful. Phase 4 is fully independent of 1–3 and is
being built first because it blocks nothing and is the most visible.

### Phase 1 — Persistence

Litestream replicates the SQLite file to Cloudflare R2 and restores it on boot.
Pairs with the `seed:if-empty` guard already shipped, which stops a deploy from
wiping accounts. A failed restore must abort startup loudly; silently booting an
empty database is indistinguishable from data loss.

Render's free tier sleeps after inactivity, so the first request after idle takes
roughly 50 seconds. Acceptable for a private group; it is the main thing that
would later justify a paid plan.

### Phase 2 — Auth for mobile — **done**

Session tokens lived in `sessionStorage`, which a webview discards on teardown,
so a native shell would have signed people out on every relaunch. Storage now
sits behind a `PersistentTokenStore` seam in `web/src/api/tokenStore.ts`. Web
keeps `sessionStorage` so the two-tab demo still works.

Two decisions worth carrying into Phase 3:

- **The seam is injectable, not sniffed.** It would have been possible to detect
  a `window.Capacitor` global and call Preferences through it. That would mean
  shipping a native code path no test in this repo can exercise, against an API
  shape that cannot be verified until the dependency exists. Phase 3 calls
  `registerTokenStore()` with a real implementation instead.
- **The cache is the runtime source of truth.** Native storage is async while
  every request builds its auth header synchronously, so the store hydrates once
  into an in-memory cache. `hydrateToken()` must be awaited before the first
  render — a screen mounting mid-hydration reads an empty token and bounces a
  signed-in person to onboarding. Phase 3 must keep that ordering when it swaps
  the store in.

### Phase 3 — Capacitor shells — **done**

Both native projects are scaffolded and committed (`web/android`, `web/ios`).
Capacitor 8 uses SPM rather than CocoaPods, so the Xcode project generated
cleanly on Windows — iOS is build-ready without a Mac having touched it.

Verified at runtime, not just in unit tests: both webview origins are echoed,
a hostile origin and the dev origin receive no `Access-Control-Allow-Origin`
header at all, the preflight permits `x-session`, and same-origin requests with
no `Origin` header are byte-for-byte unchanged.

Deferred deliberately, and not silently: **native camera capture** and
**lifecycle-driven poll backoff**. Both need a physical device to verify, and
shipping unexercised native paths is the thing Phase 2 explicitly avoided.
`usePolling` already pauses on `document.hidden`, which a webview does fire on
background, so the app is correct without the lifecycle hook — just not optimal.

#### Original plan

Two backend changes the wrap forces, neither of which is packaging work:

- **CORS must be added.** The server has no CORS middleware today because
  production is single-origin. Capacitor runs from `capacitor://localhost` (iOS)
  and `https://localhost` (Android), making every call cross-origin. Requires a
  tight allow-list, not a wildcard, because the session token rides in a header.
- **The API base URL must become configurable.** `api/client.ts` prefixes a
  relative `/api`, which inside a native shell resolves against the app bundle
  rather than the server.

Client work: drop `PhoneFrame` on native (a fake bezel and fake clock inside a
real one) in favour of real safe-area insets; native camera for proof capture;
poll backoff driven by Capacitor App lifecycle events rather than only
`document.hidden`.

### Phase 4 — Analytics dashboard — **done**

See `2026-08-06-analytics-dashboard-design.md`. Built first, as planned.

### Phase 5 — Distribution

Android: signed APK, distributed directly. iOS: gated on an Apple Developer
account and Mac access; the Xcode project is generated and committed in Phase 3
so this becomes a build step rather than a project.
