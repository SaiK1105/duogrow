import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api/client'
import type { HealthResponse, MeResponse } from '../api/types'
import { Avatar } from '../components/Avatar'
import { ScreenState } from '../components/ScreenState'
import { useToast } from '../components/toast-context'
import './profile.css'

function aiLabel(h: HealthResponse | null): { text: string; live: boolean } {
  if (!h) return { text: 'Checking…', live: false }
  const raw = String(h.aiMode ?? h.mode ?? (h.demo ? 'demo' : 'live')).toLowerCase()
  const live = raw.includes('live') || raw.includes('real') || raw.includes('anthropic')
  return { text: live ? 'Live AI' : 'Demo AI', live }
}

export function Profile() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [me, setMe] = useState<MeResponse | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    const [meResult, todayResult, healthResult] = await Promise.allSettled([api.me(), api.today(), api.health()])

    if (meResult.status === 'fulfilled') setMe(meResult.value)
    if (todayResult.status === 'fulfilled') setStreak(todayResult.value.streak)
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    else setHealth(null)
    if (meResult.status === 'rejected' || todayResult.status === 'rejected' || healthResult.status === 'rejected') setLoadError(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signOut = () => {
    clearToken()
    navigate('/', { replace: true })
  }

  const copyCode = async () => {
    if (!me?.duo) return
    try {
      await navigator.clipboard.writeText(me.duo.inviteCode)
      showToast('Invite code copied', 'success')
    } catch {
      showToast('Copy failed', 'warn')
    }
  }

  const duo = me?.duo
  const selfId = me?.user.id
  const members = duo?.members ?? []
  const self = members.find((m) => m.id === selfId) ?? me?.user
  const partner = members.find((m) => m.id !== selfId)
  const ai = aiLabel(health)

  return (
    <div className="screen profile screen__enter">
      <header className="profile__head">
        <h1 className="profile__title">Profile</h1>
        <p className="profile__sub">Your duo and settings.</p>
      </header>

      {!me && loadError ? (
        <ScreenState title="Profile is unavailable" onRetry={load} />
      ) : (
        <>

          <section className="profile__duo">
        <div className="profile__avatars">
          <Avatar name={self?.name ?? 'You'} tone="you" size={56} ring />
          <Avatar name={partner?.name ?? '?'} tone="partner" size={56} ring />
        </div>
        <p className="profile__names">
          {self?.name ?? 'You'} <span aria-hidden="true">&amp;</span> {partner?.name ?? 'Partner'}
        </p>
        {streak != null && (
          <p className="profile__streak">
            {streak}-day streak together <span aria-hidden="true">🔥</span>
          </p>
        )}
          </section>

          {duo && (
            <section className="profile__row">
              <div>
                <span className="section-title">Invite code</span>
                <p className="profile__code">{duo.inviteCode}</p>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={copyCode}>
                Copy
              </button>
            </section>
          )}

          <section className="profile__row">
            <div>
              <span className="section-title">AI verification</span>
              <p className="profile__ai-note">Powers proof checks & insights</p>
            </div>
            <span className={`profile__ai-chip ${ai.live ? 'is-live' : 'is-demo'}`}>
              <span className="profile__ai-dot" />
              {ai.text}
            </span>
          </section>

          <button type="button" className="btn btn--danger btn--block profile__signout" onClick={signOut}>
            Sign out
          </button>

          <p className="profile__foot">DuoGrow · Become better together</p>
        </>
      )}
    </div>
  )
}
