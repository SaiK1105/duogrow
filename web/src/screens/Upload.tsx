import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Proof } from '../api/types'
import { UploadDropzone } from '../components/UploadDropzone'
import { ScreenState } from '../components/ScreenState'
import { useToast } from '../components/Toast'
import { MODULE_META, MODULE_ORDER } from '../lib/format'
import type { RowKey } from '../lib/format'
import './upload.css'

type ModuleChoice = 'auto' | RowKey

const CHIPS: { value: ModuleChoice; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  ...MODULE_ORDER.map((m) => ({ value: m, label: MODULE_META[m].label })),
]

const STATUS_LINES = [
  'Reading the image…',
  "Matching to today's goals…",
  'Grounding evidence…',
  'Scoring confidence…',
]

const MIN_ANALYZE_MS = 1800

export function Upload() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [params] = useSearchParams()

  const initialModule = params.get('module') as ModuleChoice | null
  const [choice, setChoice] = useState<ModuleChoice>(
    initialModule && CHIPS.some((c) => c.value === initialModule) ? initialModule : 'auto',
  )
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [recent, setRecent] = useState<Proof[]>([])
  const [loadError, setLoadError] = useState(false)
  const [isRecentLoading, setIsRecentLoading] = useState(true)

  const loadRecent = useCallback(async () => {
    setIsRecentLoading(true)
    try {
      const res = await api.listProofs()
      setRecent(res.proofs.slice(0, 6))
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setIsRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!analyzing) return
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length)
    }, 600)
    return () => window.clearInterval(id)
  }, [analyzing])

  const onFile = (picked: File) => {
    setFile(picked)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(picked)
    })
  }

  const verify = async () => {
    if (!file) return
    setAnalyzing(true)
    setStatusIndex(0)
    const started = performance.now()
    try {
      const res = await api.uploadProof(file, choice === 'auto' ? undefined : choice)
      const elapsed = performance.now() - started
      const wait = Math.max(0, MIN_ANALYZE_MS - elapsed)
      window.setTimeout(() => navigate(`/verify/${res.proof.id}`), wait)
    } catch {
      setAnalyzing(false)
      showToast('Upload failed — try again', 'danger')
    }
  }

  return (
    <div className="screen upload screen__enter">
      <header className="upload__head">
        <h1 className="upload__title">Upload proof</h1>
        <p className="upload__sub">Snap it, drop it, let the AI verify it.</p>
      </header>

      <div className="upload__chips" role="group" aria-label="What is this proof for?">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip ${choice === c.value ? 'chip--active' : ''}`}
            onClick={() => setChoice(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {previewUrl ? (
        <div className="upload__preview">
          <img src={previewUrl} alt="Selected proof preview" className="upload__preview-img" />
          <button
            type="button"
            className="upload__change"
            onClick={() => {
              setFile(null)
              setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return null
              })
            }}
          >
            Change photo
          </button>
        </div>
      ) : (
        <UploadDropzone onFile={onFile} />
      )}

      <button type="button" className="btn btn--primary btn--block" onClick={verify} disabled={!file}>
        Verify with AI
      </button>

      {(recent.length > 0 || loadError) && (
        <section className="upload__recent">
          <h2 className="section-title">Recent proofs</h2>
          {loadError ? (
            <ScreenState title="Recent proofs are unavailable" onRetry={loadRecent} retrying={isRecentLoading} />
          ) : (
            <div className="upload__grid">
              {recent.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`upload__thumb upload__thumb--${p.band}`}
                  onClick={() => navigate(`/verify/${p.id}`)}
                >
                  <img src={p.url} alt={p.summary || 'Proof'} loading="lazy" />
                  <span className="upload__thumb-band" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {analyzing && previewUrl && (
        <div className="analyzing" role="status" aria-live="polite">
          <div className="analyzing__frame">
            <img src={previewUrl} alt="" className="analyzing__img" />
            <span className="analyzing__scan" aria-hidden="true" />
            <span className="analyzing__grid" aria-hidden="true" />
          </div>
          <p className="analyzing__label">{STATUS_LINES[statusIndex]}</p>
          <div className="analyzing__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  )
}
