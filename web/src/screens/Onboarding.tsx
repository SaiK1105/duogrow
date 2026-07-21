import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, getToken, setToken } from '../api/client'
import type { Duo } from '../api/types'
import { Avatar } from '../components/Avatar'
import { CopyIcon } from '../components/icons'
import { useToast } from '../components/toast-context'
import './onboarding.css'

type Step = 'loading' | 'name' | 'choice' | 'waiting' | 'join' | 'success'

const POLL_MS = 3000

export function Onboarding() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>('loading')
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [duo, setDuo] = useState<Duo | null>(null)
  const [partnerName, setPartnerName] = useState('your partner')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selfNameRef = useRef('You')
  const selfIdRef = useRef<string | null>(null)

  // ----- Initial session check -----
  useEffect(() => {
    let cancelled = false
    if (!getToken()) {
      setStep('name')
      return
    }
    api
      .me()
      .then((me) => {
        if (cancelled) return
        selfNameRef.current = me.user.name
        selfIdRef.current = me.user.id
        setName(me.user.name)
        if (me.duo && me.duo.members.length >= 2) {
          navigate('/today', { replace: true })
        } else if (me.duo) {
          setDuo(me.duo)
          setStep('waiting')
        } else {
          setStep('choice')
        }
      })
      .catch(() => {
        if (!cancelled) setStep('name')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  // ----- Poll for partner while waiting -----
  useEffect(() => {
    if (step !== 'waiting') return
    let cancelled = false
    const check = async () => {
      if (document.hidden) return
      try {
        const me = await api.me()
        if (cancelled || !me.duo) return
        setDuo(me.duo)
        if (me.duo.members.length >= 2) {
          const partner = me.duo.members.find((m) => m.id !== selfIdRef.current)
          setPartnerName(partner?.name ?? 'your partner')
          setStep('success')
        }
      } catch {
        /* transient — keep polling */
      }
    }
    const id = window.setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [step])

  // ----- Success beat → Today -----
  useEffect(() => {
    if (step !== 'success') return
    const id = window.setTimeout(() => navigate('/today', { replace: true }), 1800)
    return () => window.clearTimeout(id)
  }, [step, navigate])

  const fail = (err: unknown) => {
    setError(err instanceof ApiError ? err.message : 'Something went wrong')
    setBusy(false)
  }

  const submitName = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.register(trimmed)
      setToken(res.token)
      selfNameRef.current = res.user.name
      selfIdRef.current = res.user.id
      if (res.user.duoId) {
        const me = await api.me()
        setBusy(false)
        if (me.duo && me.duo.members.length >= 2) {
          navigate('/today', { replace: true })
          return
        }
        setDuo(me.duo)
        setStep('waiting')
      } else {
        setBusy(false)
        setStep('choice')
      }
    } catch (err) {
      fail(err)
    }
  }

  const createDuo = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.createDuo()
      setDuo(res.duo)
      setBusy(false)
      setStep('waiting')
    } catch (err) {
      fail(err)
    }
  }

  const joinDuo = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.joinDuo(code)
      setDuo(res.duo)
      const partner = res.duo.members.find((m) =>
        selfIdRef.current ? m.id !== selfIdRef.current : m.name !== selfNameRef.current,
      )
      setPartnerName(partner?.name ?? 'your partner')
      setBusy(false)
      setStep(res.duo.members.length >= 2 ? 'success' : 'waiting')
    } catch (err) {
      fail(err)
    }
  }

  const copyCode = async () => {
    if (!duo) return
    try {
      await navigator.clipboard.writeText(duo.inviteCode)
      showToast('Invite code copied', 'success')
    } catch {
      showToast('Copy failed — select it manually', 'warn')
    }
  }

  return (
    <div className="onb">
      <header className="onb__brand">
        <span className="onb__logo" aria-hidden="true">
          <span className="onb__logo-dot" />
        </span>
        <span className="onb__wordmark">DuoGrow</span>
        <span className="onb__tagline">Become better together</span>
      </header>

      {step === 'loading' && <p className="onb__loading">Waking the terrarium…</p>}

      {step === 'name' && (
        <section className="onb__card screen__enter">
          <h1 className="onb__heading">What should we call you?</h1>
          <p className="onb__sub">Your partner will see this name on the shared dashboard.</p>
          <input
            className="onb__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitName()}
            placeholder="First name"
            autoFocus
          />
          {error && <p className="onb__error">{error}</p>}
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={submitName}
            disabled={busy || !name.trim()}
          >
            {busy ? 'Setting up…' : 'Continue'}
          </button>
        </section>
      )}

      {step === 'choice' && (
        <section className="onb__card screen__enter">
          <h1 className="onb__heading">Start your duo</h1>
          <p className="onb__sub">Create a space and invite one partner, or join theirs.</p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={createDuo}
            disabled={busy}
          >
            Create Duo Space
          </button>
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() => setStep('join')}
            disabled={busy}
          >
            Join with code
          </button>
          {error && <p className="onb__error">{error}</p>}
        </section>
      )}

      {step === 'waiting' && duo && (
        <section className="onb__card screen__enter">
          <h1 className="onb__heading">Your invite code</h1>
          <p className="onb__sub">Share it with your partner. This screen updates the moment they join.</p>
          <div className="onb__code-card">
            <span className="onb__code">{duo.inviteCode}</span>
            <button type="button" className="onb__copy" onClick={copyCode} aria-label="Copy code">
              <CopyIcon size={18} />
            </button>
          </div>
          <div className="onb__waiting">
            <span className="onb__pulse" aria-hidden="true" />
            <span>Waiting for your partner…</span>
          </div>
          {error && <p className="onb__error">{error}</p>}
        </section>
      )}

      {step === 'join' && (
        <section className="onb__card screen__enter">
          <h1 className="onb__heading">Enter invite code</h1>
          <p className="onb__sub">Ask your partner for their 6-character code.</p>
          <input
            className="onb__input onb__input--code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && joinDuo()}
            placeholder="ABC123"
            maxLength={6}
            autoFocus
          />
          {error && <p className="onb__error">{error}</p>}
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={joinDuo}
            disabled={busy || joinCode.trim().length < 4}
          >
            {busy ? 'Joining…' : 'Join duo'}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setStep('choice')}>
            Back
          </button>
        </section>
      )}

      {step === 'success' && (
        <section className="onb__success screen__enter">
          <div className="onb__rings">
            <span className="onb__ring onb__ring--you">
              <Avatar name={selfNameRef.current} tone="you" size={64} />
            </span>
            <span className="onb__ring onb__ring--partner">
              <Avatar name={partnerName} tone="partner" size={64} />
            </span>
          </div>
          <h1 className="onb__heading">You're paired</h1>
          <p className="onb__sub">You and {partnerName} are growing together now.</p>
        </section>
      )}
    </div>
  )
}
