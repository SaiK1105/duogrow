import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { InsightsResponse, WeeklyReport } from '../api/types'
import { BulbIcon, TrophyIcon } from '../components/icons'
import { ProgressRing } from '../components/ProgressRing'
import { StatRow } from '../components/StatRow'
import { SubscoreBar } from '../components/SubscoreBar'
import { ScreenState } from '../components/ScreenState'
import { formatClock } from '../lib/format'
import './insights.css'

export function Insights() {
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    const [insightsResult, reportResult] = await Promise.allSettled([api.insights(), api.weeklyReport()])

    if (insightsResult.status === 'fulfilled') setInsights(insightsResult.value)
    if (reportResult.status === 'fulfilled') setReport(reportResult.value)
    if (insightsResult.status === 'rejected' || reportResult.status === 'rejected') setLoadError(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const riskHigh = insights ? insights.prediction.riskPercent >= 60 : false
  const riskColor = riskHigh ? 'var(--danger-500)' : 'var(--warn-500)'

  return (
    <div className="screen insights screen__enter">
      <header className="insights__head">
        <h1 className="insights__title">Insights</h1>
        <p className="insights__sub">What the AI sees in your last seven days.</p>
      </header>

      {insights ? (
        <>
          <section className="insights__growth card">
            <div className="insights__growth-ring">
              <ProgressRing value={insights.growthScore} max={100} size={172} label="Growth" />
            </div>
            <div className="insights__subscores">
              <SubscoreBar label="Discipline" value={insights.subscores.discipline} delayMs={120} />
              <SubscoreBar label="Mind" value={insights.subscores.mind} color="var(--info-400)" delayMs={220} />
              <SubscoreBar label="Health" value={insights.subscores.health} delayMs={320} />
              <SubscoreBar
                label="Consistency"
                value={insights.subscores.consistency}
                color="var(--partner-400)"
                delayMs={420}
              />
            </div>
          </section>

          <section className={`insights__card insights__prediction ${riskHigh ? 'is-danger' : ''}`}>
            <div className="insights__prediction-main">
              <span className="insights__card-eyebrow">Prediction</span>
              <p className="insights__prediction-behavior">{insights.prediction.behavior}</p>
              <p className="insights__prediction-reason">{insights.prediction.reason}</p>
            </div>
            <div className="insights__gauge">
              <ProgressRing
                value={insights.prediction.riskPercent}
                max={100}
                size={104}
                strokeWidth={9}
                color={riskColor}
                suffix="%"
                label="risk"
              />
            </div>
          </section>

          <div className="insights__pair">
            <section className="insights__card insights__mini">
              <span className="insights__mini-icon insights__mini-icon--suggest">
                <BulbIcon size={18} />
              </span>
              <span className="insights__card-eyebrow">Suggestion</span>
              <p className="insights__mini-body">{insights.suggestion}</p>
            </section>
            <section className="insights__card insights__mini">
              <span className="insights__mini-icon insights__mini-icon--strength">
                <TrophyIcon size={18} />
              </span>
              <span className="insights__card-eyebrow">Strength</span>
              <p className="insights__mini-body">{insights.strength}</p>
            </section>
          </div>
        </>
      ) : loadError ? (
        <ScreenState title="Insights are unavailable" onRetry={load} />
      ) : (
        <div className="insights__skeleton" />
      )}

      {report && (
        <section className="insights__card insights__report">
          <h2 className="section-title">Weekly report</h2>
          <div className="insights__stats">
            <StatRow label="Study time" value={formatClock(report.studyTime)} sub="h:mm" accent />
            <StatRow label="Workouts" value={`${report.workouts.done}/${report.workouts.target}`} />
            <StatRow label="Goals hit" value={`${report.goals.done}/${report.goals.target}`} />
            <StatRow label="Consistency" value={`${Math.round(report.consistency)}%`} />
          </div>
          <p className="insights__verdict">{report.verdict}</p>
        </section>
      )}
    </div>
  )
}
