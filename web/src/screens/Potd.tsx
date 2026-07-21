import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { PotdBankItem, PotdTodayResponse } from '../api/types'
import { DifficultyPill } from '../components/DifficultyPill'
import { CheckIcon } from '../components/icons'
import { ScreenState } from '../components/ScreenState'
import { useToast } from '../components/toast-context'
import './potd.css'

const LONG_BODY = 200

function StatusChip({ status }: { status: string }) {
  const solved = status === 'solved'
  return (
    <span className={`potd__partner-chip ${solved ? 'is-solved' : ''}`}>
      {solved ? 'Solved' : status === 'attempted' ? 'Attempting' : 'Not started'}
    </span>
  )
}

export function Potd() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [today, setToday] = useState<PotdTodayResponse | null>(null)
  const [bank, setBank] = useState<PotdBankItem[]>([])
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadError(false)
    const [todayResult, bankResult] = await Promise.allSettled([api.potdToday(), api.potdBank()])

    if (todayResult.status === 'fulfilled') setToday(todayResult.value)
    if (bankResult.status === 'fulfilled') setBank(bankResult.value.questions)
    if (todayResult.status === 'rejected' || bankResult.status === 'rejected') setLoadError(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setImporting(true)
    try {
      const res = await api.potdUpload(file)
      showToast(`Imported ${res.added} question${res.added === 1 ? '' : 's'}`, 'success')
      await load()
    } catch {
      showToast('Import failed — check the file', 'danger')
    } finally {
      setImporting(false)
    }
  }

  const q = today?.yours.question
  const bodyLong = q ? q.body.length > LONG_BODY : false
  const body = q ? (bodyLong && !expanded ? `${q.body.slice(0, LONG_BODY)}…` : q.body) : ''

  return (
    <div className="screen potd screen__enter">
      <header className="potd__head">
        <h1 className="potd__title">Problem of the Day</h1>
        <p className="potd__sub">Solve it, upload proof, keep the mind score climbing.</p>
      </header>

      {q ? (
        <article className="potd__card">
          <div className="potd__meta">
            <DifficultyPill level={q.difficulty} />
            <span className="potd__topic">{q.topic}</span>
          </div>
          <h2 className="potd__q-title">{q.title}</h2>
          <p className="potd__body">{body}</p>
          {bodyLong && (
            <button type="button" className="potd__more" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <div className="potd__provenance">
            <span className="potd__source">from {q.source}</span>
            {today?.partners && (
              <span className="potd__partner">
                Partner <StatusChip status={today.partners.status} />
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => navigate('/upload?module=potd')}
          >
            I solved it — upload proof
          </button>
        </article>
      ) : loadError ? (
        <ScreenState title="Problem of the Day is unavailable" onRetry={load} />
      ) : (
        <div className="potd__skeleton" />
      )}

      <section className="potd__bank">
        <div className="potd__bank-head">
          <h2 className="section-title">Question bank</h2>
          <button
            type="button"
            className="potd__import"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing…' : '+ Import CSV / PDF'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            className="potd__import-input"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>

        <ul className="potd__bank-list">
          {bank.length === 0 && <li className="potd__bank-empty">No questions yet — import a set to seed the bank.</li>}
          {bank.map((item) => (
            <li key={item.id} className="potd__bank-item">
              <span className={`potd__bank-check ${item.solved ? 'is-solved' : ''}`} aria-hidden="true">
                {item.solved && <CheckIcon size={13} />}
              </span>
              <span className="potd__bank-title">{item.title}</span>
              {item.difficulty && <DifficultyPill level={item.difficulty} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
