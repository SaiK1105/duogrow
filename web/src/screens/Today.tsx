import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { ModuleKey, Snapshot } from '../api/types'
import { CheerButton } from '../components/CheerButton'
import { CoachBubble } from '../components/CoachBubble'
import { DuoProgressBar } from '../components/DuoProgressBar'
import { MinusIcon, PlusIcon, UploadIcon } from '../components/icons'
import { ModuleRow } from '../components/ModuleRow'
import { StreakFlame } from '../components/StreakFlame'
import { useToast } from '../components/Toast'
import { usePolling } from '../hooks/usePolling'
import { formatModuleValue, greeting, MODULE_META, MODULE_ORDER } from '../lib/format'
import type { RowKey } from '../lib/format'
import './today.css'

function moduleValue(snap: Snapshot | null, key: ModuleKey): number {
  return snap?.modules?.[key]?.value ?? 0
}

export function Today() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data, refetch } = usePolling(api.today, 3000)
  const shownCheers = useRef<Set<string>>(new Set())

  // Surface unseen cheers from partner as toasts, then mark them seen.
  useEffect(() => {
    if (!data) return
    for (const cheer of data.unseenCheers) {
      if (shownCheers.current.has(cheer.id)) continue
      shownCheers.current.add(cheer.id)
      showToast(`${cheer.emoji} ${cheer.fromName} cheered you on!`, 'success')
      void api.seenCheer(cheer.id).catch(() => undefined)
    }
  }, [data, showToast])

  const mutate = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        await refetch()
      } catch {
        showToast('Could not save that — try again', 'danger')
      }
    },
    [refetch, showToast],
  )

  const setModule = (module: ModuleKey, patch: { status?: string; value?: number }) =>
    mutate(() => api.updateModule(module, patch))

  const sendCheer = () =>
    mutate(async () => {
      await api.cheer('🎉')
      showToast('Cheer sent 🎉', 'success')
    })

  const logMeal = () => {
    const raw = window.prompt('Calories for this meal?', '500')
    if (raw == null) return
    const kcal = parseInt(raw, 10)
    if (Number.isNaN(kcal) || kcal <= 0) {
      showToast('Enter a number of calories', 'warn')
      return
    }
    void setModule('diet', { value: moduleValue(data?.you ?? null, 'diet') + kcal })
  }

  if (!data) {
    return (
      <div className="screen today">
        <div className="today__skeleton" />
        <div className="today__skeleton today__skeleton--tall" />
      </div>
    )
  }

  const you = data.you
  const partner = data.partner
  const youName = you.name

  const actionFor = (key: RowKey): React.ReactNode => {
    const done = key === 'potd' ? you.potd?.status === 'solved' : you.modules[key as ModuleKey]?.status === 'done'
    switch (key) {
      case 'wake':
        return done ? null : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModule('wake', { status: 'done' })}>
            Check in
          </button>
        )
      case 'study':
        return (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setModule('study', { value: moduleValue(you, 'study') + 30 })}
          >
            +30m
          </button>
        )
      case 'workout':
        return done ? null : (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModule('workout', { status: 'done' })}>
            Mark done
          </button>
        )
      case 'diet':
        return (
          <button type="button" className="btn btn--ghost btn--sm" onClick={logMeal}>
            + Log meal
          </button>
        )
      case 'tasks': {
        const cur = moduleValue(you, 'tasks')
        return (
          <span className="today__stepper">
            <button
              type="button"
              className="today__step-btn"
              onClick={() => setModule('tasks', { value: Math.max(0, cur - 1) })}
              aria-label="Remove a task"
            >
              <MinusIcon size={16} />
            </button>
            <span className="today__step-count">{cur}</span>
            <button
              type="button"
              className="today__step-btn"
              onClick={() => setModule('tasks', { value: cur + 1 })}
              aria-label="Add a task"
            >
              <PlusIcon size={16} />
            </button>
          </span>
        )
      }
      default:
        return null
    }
  }

  return (
    <div className="screen today screen__enter">
      <header className="today__head">
        <div>
          <p className="today__greeting">
            {greeting()}, <span>{youName.split(' ')[0]}</span>
          </p>
          <p className="today__date">{data.date}</p>
        </div>
        <StreakFlame count={data.streak} />
      </header>

      <CoachBubble
        message={data.coachMessage}
        mood={data.duoProgress >= 80 ? 'celebrate' : data.duoProgress < 40 ? 'warn' : 'neutral'}
      />

      <DuoProgressBar
        duoProgress={data.duoProgress}
        youPercent={you.progress}
        partnerPercent={partner?.progress ?? 0}
        youName={youName}
        partnerName={partner?.name ?? 'Partner'}
      />

      <div className="today__legend">
        <span className="today__legend-item">
          <span className="today__dot today__dot--you" /> You
        </span>
        <span className="today__legend-item">
          <span className="today__dot today__dot--partner" /> {partner?.name ?? 'Partner'}
        </span>
      </div>

      <div className="today__rows">
        {MODULE_ORDER.map((key) => {
          const isPotd = key === 'potd'
          const youState = isPotd ? undefined : you.modules[key as ModuleKey]
          const partnerState = isPotd ? undefined : partner?.modules[key as ModuleKey]
          const youView = {
            value: isPotd ? (you.potd ? (you.potd.status === 'solved' ? 'Solved' : 'Open') : '—') : formatModuleValue(key, youState),
            done: isPotd ? you.potd?.status === 'solved' : youState?.status === 'done',
          }
          const partnerView = partner
            ? {
                value: isPotd
                  ? partner.potd
                    ? partner.potd.status === 'solved'
                      ? 'Solved'
                      : 'Open'
                    : '—'
                  : formatModuleValue(key, partnerState),
                done: isPotd ? partner.potd?.status === 'solved' : partnerState?.status === 'done',
              }
            : null

          return (
            <ModuleRow
              key={key}
              module={key}
              label={MODULE_META[key].label}
              you={{ value: youView.value, done: Boolean(youView.done) }}
              partner={partnerView ? { value: partnerView.value, done: Boolean(partnerView.done) } : null}
              action={actionFor(key)}
              onPress={isPotd ? () => navigate('/potd') : undefined}
            />
          )
        })}
      </div>

      <div className="today__actions">
        <button type="button" className="btn btn--primary today__upload" onClick={() => navigate('/upload')}>
          <UploadIcon size={18} />
          Upload Proof
        </button>
        <CheerButton onCheer={sendCheer} />
      </div>
    </div>
  )
}
