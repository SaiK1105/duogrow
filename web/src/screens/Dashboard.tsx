import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { AnalyticsRangeDays, AnalyticsSummary } from '../api/types'
import { CalendarHeatmap } from '../components/CalendarHeatmap'
import { DeltaStat } from '../components/DeltaStat'
import { ModuleComparison, type ComparisonGroup } from '../components/ModuleComparison'
import { ProofHistoryTable } from '../components/ProofHistoryTable'
import { ScreenState } from '../components/ScreenState'
import { TrendChart, type TrendSeries } from '../components/TrendChart'
import { MODULE_META } from '../lib/format'
import './dashboard.css'

const RANGES: AnalyticsRangeDays[] = [30, 90, 365]

/** Member 0 is "you" green, member 1 the partner hue; beyond that we cycle. */
const MEMBER_COLORS = ['var(--accent-500)', 'var(--partner-500)', 'var(--info-400)', 'var(--warn-500)']

function memberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}

function hasAnyValue(values: number[]): boolean {
  return values.some((value) => value > 0)
}

/** Short axis label: '2026-07-22' → 'Jul 22'. Parsed by field to stay TZ-stable. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return month && day ? `${months[month - 1]} ${day}` : isoDate
}

export function Dashboard() {
  const [days, setDays] = useState<AnalyticsRangeDays>(30)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Analytics is historical, so this deliberately does not poll: mount, range
  // change, and the explicit refresh are the only three ways it refetches.
  const load = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      setSummary(await api.analyticsSummary(days))
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const memberNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const member of summary?.members ?? []) names[member.userId] = member.name
    return names
  }, [summary])

  const trendSeries: TrendSeries[] = useMemo(
    () =>
      (summary?.members ?? []).map((member, index) => ({
        label: member.name,
        color: memberColor(index),
        values: (summary?.series ?? []).map((point) => point.values[index] ?? 0),
      })),
    [summary],
  )

  const heatmapDays = useMemo(
    () =>
      (summary?.series ?? []).map((point) => ({
        date: point.date,
        // The duo's day reads as the mean of its members, so one member's blank
        // day dims the cell instead of hiding behind the other's streak.
        value: point.values.length > 0 ? point.values.reduce((a, b) => a + b, 0) / point.values.length : 0,
      })),
    [summary],
  )

  const moduleGroups: ComparisonGroup[] = useMemo(
    () =>
      (summary?.modules ?? []).map((row) => ({
        label: MODULE_META[row.module].label,
        bars: (summary?.members ?? []).map((member, index) => ({
          label: member.name,
          color: memberColor(index),
          value: row.averages[index] ?? 0,
          detail: `${row.doneDays[index] ?? 0} days done`,
        })),
      })),
    [summary],
  )

  const rangeSelector = (
    <div className="dashboard__ranges" role="group" aria-label="Date range">
      {RANGES.map((option) => (
        <button
          key={option}
          type="button"
          className={`chip ${option === days ? 'chip--active' : ''}`}
          aria-pressed={option === days}
          onClick={() => setDays(option)}
        >
          {option} days
        </button>
      ))}
      <button type="button" className="btn btn--outline btn--sm" onClick={() => void load()} disabled={isLoading}>
        {isLoading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )

  const hasCurrentData =
    summary !== null &&
    (summary.series.some((point) => hasAnyValue(point.values)) || hasAnyValue(summary.current.completion))
  const hasEarlierData = summary !== null && hasAnyValue(summary.previous.completion)

  return (
    <div className="dashboard">
      <header className="dashboard__head">
        <div>
          <h1 className="dashboard__title">Duo analytics</h1>
          <p className="dashboard__sub">
            {summary ? `${summary.range.from} → ${summary.range.to}` : 'Long-range history for your duo.'}
          </p>
        </div>
        {rangeSelector}
      </header>

      {hasError ? (
        <ScreenState title="Analytics are unavailable" onRetry={() => void load()} retrying={isLoading} />
      ) : summary === null ? (
        <div className="dashboard__skeleton" role="status" aria-live="polite">
          Loading analytics…
        </div>
      ) : !hasCurrentData && !hasEarlierData ? (
        <section className="dashboard__notice card">
          <h2 className="dashboard__notice-title">No history yet</h2>
          <p className="dashboard__notice-body">
            Nothing has been logged for this duo so far. Analytics fill in as you and your partner complete modules and
            upload proofs — check back after a few days of activity.
          </p>
        </section>
      ) : !hasCurrentData ? (
        <section className="dashboard__notice card">
          <h2 className="dashboard__notice-title">Nothing logged in this window</h2>
          <p className="dashboard__notice-body">
            This duo has earlier activity, just none in the last {days} days. Widen the range to see it.
          </p>
          <div className="dashboard__ranges">
            {RANGES.filter((option) => option > days).map((option) => (
              <button key={option} type="button" className="btn btn--outline btn--sm" onClick={() => setDays(option)}>
                Show {option} days
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="dashboard__grid">
          <section className="dashboard__stats">
            <DeltaStat
              label="Growth score"
              value={String(summary.current.growthScore)}
              delta={summary.current.growthScore - summary.previous.growthScore}
              comparison={`vs previous ${days} days`}
            />
            <DeltaStat
              label="Discipline"
              value={String(summary.current.subscores.discipline)}
              delta={summary.current.subscores.discipline - summary.previous.subscores.discipline}
              comparison={`vs previous ${days} days`}
            />
            <DeltaStat
              label="Consistency"
              value={String(summary.current.subscores.consistency)}
              delta={summary.current.subscores.consistency - summary.previous.subscores.consistency}
              comparison={`vs previous ${days} days`}
            />
            {summary.members.map((member, index) => (
              <DeltaStat
                key={member.userId}
                label={`${member.name} completion`}
                value={`${Math.round((summary.current.completion[index] ?? 0) * 100)}%`}
                delta={
                  ((summary.current.completion[index] ?? 0) - (summary.previous.completion[index] ?? 0)) * 100
                }
                deltaUnit="%"
                comparison={`vs previous ${days} days`}
              />
            ))}
          </section>

          <section className="dashboard__card dashboard__card--wide">
            <h2 className="section-title">Daily completion trend</h2>
            <TrendChart
              labels={summary.series.map((point) => shortDate(point.date))}
              series={trendSeries}
              title={`Daily completion per member over the last ${days} days`}
              description={`Each line is one member's mean completion across the five modules, ${summary.range.from} to ${summary.range.to}.`}
            />
          </section>

          <section className="dashboard__card">
            <h2 className="section-title">Consistency calendar</h2>
            <CalendarHeatmap
              days={heatmapDays}
              title={`Duo completion for each of the last ${days} days, one column per week`}
            />
          </section>

          <section className="dashboard__card">
            <h2 className="section-title">Module comparison</h2>
            <ModuleComparison groups={moduleGroups} title="Average module completion per member" />
          </section>

          <section className="dashboard__card dashboard__card--wide">
            <h2 className="section-title">Proof history</h2>
            <ProofHistoryTable memberNames={memberNames} />
          </section>
        </div>
      )}
    </div>
  )
}
