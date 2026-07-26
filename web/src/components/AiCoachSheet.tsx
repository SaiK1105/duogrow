import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, ApiError } from '../api/client'
import type { AiFeature, AiGenerationResponse, AiLimitReason, AiLimitRetry, AiSettings } from '../api/types'
import './ai-coach-sheet.css'

type CoachClient = Pick<typeof api, 'dailyPlan' | 'duoReflection' | 'potdTutor' | 'insightsExplain' | 'chat'>
export type CoachAction = 'daily_plan' | 'duo_reflection' | 'potd_tutor' | 'insights_explain'

interface AiCoachSheetProps {
  isOpen: boolean
  settings: AiSettings
  onClose: () => void
  initialAction?: CoachAction
  client?: Partial<CoachClient>
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), textarea:not([disabled])'
const MAX_CHAT_CHARS = 500

const ACTION_LABELS: Record<CoachAction, string> = {
  daily_plan: 'Create daily plan',
  duo_reflection: 'Duo reflection',
  potd_tutor: 'POTD tutor',
  insights_explain: 'Explain insights',
}

export function AiCoachSheet({ isOpen, settings, onClose, initialAction, client = {} }: AiCoachSheetProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState<{ result: AiGenerationResponse; feature: AiFeature } | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [retry, setRetry] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!isOpen) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setResponse(null)
    setError('')
    setRetry(null)
    queueMicrotask(() => dialogRef.current?.querySelector<HTMLElement>('button')?.focus())
    return () => returnFocusRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const appRoot = document.getElementById('root')
    if (!appRoot) return
    const wasInert = appRoot.inert
    appRoot.inert = true
    return () => { appRoot.inert = wasInert }
  }, [isOpen])

  if (!isOpen) return null

  const request = async (feature: AiFeature, action: () => Promise<AiGenerationResponse>) => {
    if (!settings.personalEnabled) {
      setError('Enable personal AI consent in Privacy controls before requesting coaching.')
      return
    }
    setPending(true)
    setError('')
    setRetry(() => () => { void request(feature, action) })
    try {
      setResponse({ result: await action(), feature })
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : typeof caught === 'object' && caught !== null && 'status' in caught ? Number(caught.status) : 0
      const message = caught instanceof Error ? caught.message : ''
      const limit = getAiLimit(caught)
      if (status === 429) setRetry(null)
      setError(
        status === 429 && limit
          ? limitMessage(limit.reason, limit.retry)
          : status === 429
            ? 'AI requests are currently unavailable. Please try again later.'
          : message.includes('mutual duo consent')
            ? 'Duo Reflection needs both partners consent before it can run.'
            : 'Coaching is unavailable right now. Please retry.',
      )
    } finally {
      setPending(false)
    }
  }

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const sendChat = () => {
    if (message.length > MAX_CHAT_CHARS) { setError('Use 500 characters or fewer for a chat message.'); return }
    if (!message.trim()) { setError('Write a message before sending.'); return }
    void request('chat', () => (client.chat ?? api.chat)(message.trim()))
  }

  return createPortal(
    <div className="ai-coach-sheet__backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }} onKeyDown={trapFocus}>
      <section ref={dialogRef} className="ai-coach-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-coach-sheet-title" aria-describedby="ai-coach-sheet-description">
        <div className="ai-coach-sheet__header">
          <div><p className="ai-coach-sheet__eyebrow">Private, optional support</p><h2 id="ai-coach-sheet-title">DuoGrow AI coach</h2></div>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} aria-label="Close AI coach">Close</button>
        </div>
        {initialAction && <p className="ai-coach-sheet__selected-action">Selected action: {ACTION_LABELS[initialAction]}</p>}
        <p id="ai-coach-sheet-description">General coaching uses aggregate progress and goals only. Insight Explain uses numeric insight signals. POTD Tutor uses the current problem title, prompt, topic, and difficulty. Proof media is never shared.</p>
        <p className="ai-coach-sheet__mode">{settings.mode === 'demo' ? 'Demo coaching' : settings.mode === 'live' ? 'Live coaching' : 'AI coaching is off'} · daily budget applies</p>
        <div className="ai-coach-sheet__actions" aria-label="Coaching tools">
          <button className="btn btn--outline" type="button" disabled={pending} onClick={() => void request('daily_plan', client.dailyPlan ?? api.dailyPlan)}>Create daily plan</button>
          <button className="btn btn--outline" type="button" disabled={pending || !settings.duoEnabled || !settings.mutualDuoConsent} onClick={() => void request('duo_reflection', client.duoReflection ?? api.duoReflection)}>Duo reflection</button>
          <button className="btn btn--outline" type="button" disabled={pending} onClick={() => void request('potd_tutor', client.potdTutor ?? api.potdTutor)}>POTD tutor</button>
          <button className="btn btn--outline" type="button" disabled={pending} onClick={() => void request('insights_explain', client.insightsExplain ?? api.insightsExplain)}>Explain insights</button>
        </div>
        {!settings.mutualDuoConsent && <p className="ai-coach-sheet__note">Both partners must enable Duo Reflection before it is available.</p>}
        <label className="ai-coach-sheet__label" htmlFor="ai-coach-message">Ask your coach</label>
        <textarea id="ai-coach-message" value={message} maxLength={MAX_CHAT_CHARS} onChange={(event) => setMessage(event.target.value)} aria-describedby="ai-coach-counter" />
        <p id="ai-coach-counter" className="ai-coach-sheet__counter">{message.length}/{MAX_CHAT_CHARS}</p>
        <p className="ai-coach-sheet__note">Ephemeral chat sends the message you enter to the coaching provider and is not saved by DuoGrow. Do not include sensitive personal information.</p>
        <button className="btn btn--primary" type="button" disabled={pending} onClick={sendChat}>Send message</button>
        {pending && <p role="status" aria-live="polite">Coaching is thinking…</p>}
        {error && <><p role={error.startsWith('Enable') ? 'status' : 'alert'} aria-live="polite" className="ai-coach-sheet__error">{error}</p>{retry && !error.startsWith('Enable') && <button className="btn btn--outline" type="button" onClick={retry}>Retry</button>}</>}
        {response && <div className="ai-coach-sheet__response" aria-live="polite"><p role="status">{response.result.mode === 'demo' ? 'Demo coaching' : 'Live coaching'} response ready</p><p>{response.result.text}</p><p>{response.feature === 'duo_reflection' ? `${response.result.remaining} Duo Reflection request${response.result.remaining === 1 ? '' : 's'} remaining this week` : `${response.result.remaining} request${response.result.remaining === 1 ? '' : 's'} remaining today`}</p></div>}
      </section>
    </div>, document.body,
  )
}

function getAiLimit(error: unknown): { reason: AiLimitReason; retry: AiLimitRetry } | undefined {
  if (!error || typeof error !== 'object' || !('reason' in error) || !('retry' in error)) return undefined
  const { reason, retry } = error
  if (!isAiLimitReason(reason) || !isAiLimitRetry(retry)) return undefined
  return { reason, retry }
}

function isAiLimitReason(value: unknown): value is AiLimitReason {
  return value === 'feature_quota' || value === 'daily_budget' || value === 'monthly_budget'
}

function isAiLimitRetry(value: unknown): value is AiLimitRetry {
  return value === 'tomorrow' || value === 'next_week' || value === 'next_month'
}

function limitMessage(reason: AiLimitReason, retry: AiLimitRetry): string {
  if (reason === 'daily_budget') return 'Your daily AI budget has been reached. Try again tomorrow.'
  if (reason === 'monthly_budget') return 'AI coaching is temporarily unavailable. Try again next month.'
  return retry === 'next_week'
    ? 'Your duo has used its weekly Duo Reflection. Try again next week.'
    : 'This coaching tool has reached its daily request limit. Try again tomorrow.'
}
