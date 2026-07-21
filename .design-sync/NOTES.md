# design-sync notes — DuoGrow

## Run mode
- 2026-07-21: User chose **local-only** — build + verify the full `ds-bundle/` but do NOT
  create a claude.ai/design project and do NOT upload. No `projectId` is pinned on purpose.
  If a future run is asked to upload, it starts at §1 (fresh project) as a first sync.

## Repo shape
- Repo is an APP, not a component library: no Storybook, no stories, no library `dist/`.
  Shape = `package` in **synth-entry mode** (no built dist — the converter synthesizes an
  entry from `web/src/components/*.tsx`). Build discovers 38 PascalCase exports (19 real
  presentational components + ~19 icons).
- The converter needs `web` resolvable inside `web/node_modules`: a **self-junction** is
  created — `web/node_modules/web -> web` (Windows junction). Recreate on a fresh clone:
  `New-Item -ItemType Junction -Path web/node_modules/web -Target (Resolve-Path web)`.
- `globalName: DuoGrow` → components load from `window.DuoGrow.*`.

## Styling / tokens / fonts
- Components are plain React 19 + plain CSS (no CSS modules, no Tailwind). No provider/theme
  wrapper needed; styling comes from `web/src/styles/tokens.css` custom props on `:root`
  plus each component's co-located `<name>.css`.
- Config copies ALL of `web/src/styles/*.css` as "tokens" (`tokensPkg: "web"`,
  `tokensGlob: "src/styles/*.css"`): tokens.css (the `:root` vars), global.css (dark body
  base + reset — its `@import './tokens.css'` resolves to the sibling copy), ui.css (the
  `.btn`/`.chip`/`.card`/`.section-title` utility classes), and ds-fonts.css (below).
- Do NOT set `cssEntry` — in synth mode component CSS auto-bundles into `_ds_bundle.css`.
  Setting cssEntry to global.css re-introduced a dangling root `@import "./tokens.css"`.
- **Fonts** (Space Grotesk display, Inter UI) load via a Google Fonts `<link>` in
  `web/index.html` at runtime. To make preview cards + designs render in-brand, a sync-only
  file `web/src/styles/ds-fonts.css` holds the Google Fonts `@import` — the app never imports
  it (index.html has the link); the glob pulls it into the styles.css closure. Validate
  reports `[FONT_REMOTE]` (informational, not missing).

## Design language ("Night Terrarium")
- Dark oklch surfaces (`--surface-void/base/raised/...`), bioluminescent green accent
  (`--accent-500` primary, "you"), amber partner hue (`--partner-400`, "Sai"), confidence
  bands high=green / medium=amber / low=red.

## Preview authoring (hero-components scope)
- User scope (2026-07-21): **hero components only** — authored rich previews for the ~18
  distinctive presentational components; the ~19 icons stay importable + documented, on floor
  cards. Preview files live in `.design-sync/previews/<Name>.tsx`, graded good in `.cache/`.
- **THE key pattern**: the preview HTML body is WHITE by default, so every authored cell MUST
  sit on a dark surface — wrap in `<div style={{background:'var(--surface-void)', padding:28, …}}>`.
  Without it, dark-on-dark components read as blobs on white. This single fact drove every preview.
- Row-list components (StatRow, ModuleRow, SubscoreBar breakdown) look most finished wrapped
  in a `.card`-style panel: `--surface-raised` + `--surface-border` + radius 16 + padding 16.
- Import components from `'web'` in previews (esbuild rewrites to `window.DuoGrow`).
- Compound/context specifics: SubscoreBar takes `color`/`delayMs`; ModuleRow `module` is
  `RowKey` (`wake|study|workout|diet|tasks|potd`), `partner` is `SideView|null`; Band is
  `high|medium|low`; Avatar `tone` is `you|partner|neutral`.

## Floor-card components (deliberate, not failures)
- **The 19 icons** (WakeIcon, StudyIcon, HomeIcon, …, ModuleIcon dispatcher): tiny SVG
  glyphs — kept importable + listed in conventions.md, floor cards only (per user's
  hero-only scope). They validate as `[RENDER_THIN]` — **expected**, recorded as known warns.
- **ToastProvider**: a React context provider; a toast only appears after `showToast()` is
  called (interaction-driven), so nothing renders statically → floor card by design.
- **TabBar**: uses react-router (`useNavigate`/`NavLink`) AND the bundle inlines its own
  React, so a `MemoryRouter` imported into the preview runs on a DIFFERENT React instance than
  the bundled TabBar → the Router context doesn't cross (dual-React), preview renders blank.
  Left on the floor card. To author it later: merge `react-router-dom` into the bundle via
  `cfg.extraEntries` so it shares the bundle's React, then wrap via `cfg.provider`.

## Known render warns (checked & expected — a re-sync should NOT treat these as new)
- All 19 icons: `[RENDER_THIN]` — they are ~22px glyphs. Expected.
- Count-up numbers (ProgressRing, DuoProgressBar, ConfidenceBadge with `animated`) are
  screenshotted mid-animation, so a headline may read e.g. 82 vs target 86 / 42% vs 43%.
  Expected — the previews pass `animated={false}` where the prop exists; ring count-up has no
  such prop. Not a defect.

## Re-sync risks (what can silently go stale)
- The `web/node_modules/web` self-junction and `web/src/styles/ds-fonts.css` are prerequisites
  the build depends on — both are committed/recreatable, but a teammate cloning fresh must
  recreate the junction (it's gitignored as part of node_modules).
- If the app adds real Storybook or a library build later, re-detect the shape (this config
  pins `shape: package`).
- Previews reference specific props/enums (RowKey, Band, AvatarTone); if those types change in
  `web/src`, the affected previews may need updating — re-run capture and re-grade.
- Fonts are remote (`ds-fonts.css` @import); an offline capture renders fallback fonts.
