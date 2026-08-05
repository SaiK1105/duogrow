# Analytics dashboard — design — 2026-08-06

Phase 4 of `2026-08-06-multiplatform-roadmap-design.md`, and the first phase to
be built. It is independent of the persistence and Capacitor phases.

## Purpose

The phone UI already works in a browser, so a dashboard earns its place only by
showing what a phone cannot: history over weeks, trends, and comparison. Today
the app answers "how are we doing right now"; the dashboard answers "how have we
been doing, and is it getting better".

This is a **desktop-first surface**, not a responsive re-layout of the existing
screens.

## Scope

In scope:

- A `/dashboard` route rendered outside the phone frame
- Trend lines for completion and growth score over a selectable range
- A streak calendar heatmap
- Per-module comparison between both duo members
- Full proof history with filtering
- Period-over-period comparison
- Two new read-only aggregate endpoints

Out of scope: CSV export, an arbitrary date-range picker (presets only), any
change to authentication, and any change to the existing seven screens.

## Architecture

### Shell restructuring

`App.tsx` currently wraps *every* route in `AmbientBackdrop` → `PhoneFrame` →
`screen-scroll`. The dashboard cannot live inside a 390px-wide fake phone, so
`App` gains a second shell: routes render either the phone shell (all existing
screens, unchanged) or a full-width dashboard shell. `TabBar` is already
pathname-gated and simply will not list `/dashboard`.

This is the only change to existing application structure. No existing screen is
modified.

### Code splitting

The dashboard is loaded with `React.lazy` and a Suspense fallback. This is not a
micro-optimisation: the production bundle is already 298 kB (92 kB gzipped),
at the ceiling of the project's app-page budget, and Phase 3 wraps this same
bundle into the native apps. Phone users must not download dashboard and chart
code they can never reach from the tab bar.

For the same reason charts are hand-rolled inline SVG. A charting library would
add more weight than the entire feature.

## Data

### `GET /api/analytics/summary?days=<30|90|365>`

Duo-scoped, session-authenticated. Returns one payload covering every chart so
the dashboard makes a single request:

- `range` — resolved `from`, `to`, and `days`
- `members` — id and name; every other array is positionally parallel to this
  one, so the client never needs an id lookup map
- `series` — per day, per member: completion
- `modules` — per module, per member: averages and completed-day counts
- `current` / `previous` — growth score, subscores, and mean completion for this
  period and the immediately preceding period of equal length, so the UI renders
  deltas without a second request

Two shape decisions made during implementation:

**Growth score is per period, not per day.** It is defined over a window, so a
daily value would be noise rather than a trend — and computing one per day would
mean 365 windowed aggregations per request. The per-day series carries
completion, which is genuinely a daily quantity.

**There is no `calendar` field.** The heatmap is derived client-side from
`series`, which already holds exactly the per-day per-member numbers it needs.
Shipping the same data twice under two names would invite the two copies to
disagree.

`days` is validated against an explicit allow-list. Anything else is rejected
rather than clamped, so a malformed value cannot silently produce a different
range than the caller believes it requested.

### `GET /api/analytics/proofs?module=&status=&limit=&cursor=`

The existing `GET /api/proofs` returns a fixed 12 most-recent rows with no
filtering, which is right for the phone and useless for history. This adds
filtering by module and verification status with cursor pagination and a bounded
`limit`.

Both endpoints are read-only and duo-scoped through the caller's `duo_id`.
`idx_daily_entries_duo_date` and `idx_proofs_duo(duo_id, created_at)` already
cover the access patterns.

Score maths must not be reimplemented — two definitions of "growth score" that
drift apart would be worse than no dashboard.

**Resolved during implementation:** `computeDuoGrowth(duoId, members, streak, days)`
already accepts its window as a `days: string[]` parameter and queries
`BETWEEN days[0] AND days[last]`. Only its doc comment claims "last 7 days"; the
function itself is range-agnostic. `lastNDays(n, endDate)` is likewise
parameterised. Reuse is therefore direct — a new aggregation module was not
needed. `lib/analytics.ts` composes these existing functions and adds only the
per-day completion roll-up they do not provide.

### Freshness

Analytics is historical, not live, so the dashboard does **not** use the 3-second
`usePolling` loop. It fetches once on mount and offers an explicit refresh.
Polling a heavy aggregate every three seconds would be pure waste.

## Components

New, each with one purpose and independently testable:

| Component | Purpose |
|---|---|
| `Dashboard` | Screen: layout, range selection, data fetching |
| `DashboardShell` | Full-width shell with sidebar — the non-phone layout tier |
| `TrendChart` | SVG line chart, two series (one per member) |
| `CalendarHeatmap` | SVG day grid banded by completion |
| `ModuleComparison` | Grouped bars, per module, per member |
| `DeltaStat` | A single metric with its period-over-period change |
| `ProofHistoryTable` | Filterable, paginated proof list |

The chart components take plain data plus dimensions and return SVG. They know
nothing about DuoGrow's API types, which keeps their maths unit-testable in
isolation.

## Error and empty states

Reuses the existing `ScreenState` component for failure with retry. Three cases
must be handled distinctly rather than collapsing into one message:

- **Request failed** — error with retry
- **Duo has no history yet** — a genuine empty state explaining data appears as
  entries accumulate, not an error
- **Range has no data but earlier data exists** — prompt to widen the range

A new duo hitting an error-styled screen on day one would be a bug, not an edge
case.

## Responsive behaviour

Desktop-first: multi-column grid above 1100px, two columns above 800px, single
stacked column below. It stays usable on a phone rather than redirecting, so a
link shared to a phone does not dead-end — but it is not the phone experience and
is not linked from the tab bar.

## Testing

**Server** (`node:test`, colocated `*.test.ts`):

- `days` allow-list rejects unlisted values
- A caller cannot read analytics for a duo they do not belong to
- Aggregation matches hand-computed expectations on seeded data
- An empty range returns empty series rather than erroring
- Proof filtering and cursor pagination return stable, non-overlapping pages

**Web** (Vitest + Testing Library):

- Dashboard renders loading, error, empty, and populated states
- Range selection refetches
- Chart components tested on their scale and path maths with known inputs, not
  by snapshot — snapshots of generated SVG paths break on every visual tweak and
  assert nothing meaningful

## Risks

- **Bundle budget.** Mitigated by lazy loading and hand-rolled SVG; the
  production build size is checked before merge.
- **Aggregate cost on a free instance.** Ranges are bounded and indexed. A
  365-day range over a two-person duo is a few hundred rows.
- **Scope creep into a BI tool.** The preset ranges and the explicit exclusion of
  export exist to hold this line.
