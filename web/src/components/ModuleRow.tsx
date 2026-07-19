import type { RowKey } from '../lib/format'
import { CheckIcon, ModuleIcon } from './icons'
import './module-row.css'

interface SideView {
  value: string
  done: boolean
}

interface ModuleRowProps {
  module: RowKey
  label: string
  you: SideView
  partner: SideView | null
  /** Quick-action control for YOUR side. */
  action?: React.ReactNode
  onPress?: () => void
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <span className={`mrow__status ${done ? 'is-done' : 'is-pending'}`} aria-hidden="true">
      {done ? <CheckIcon size={13} /> : <span className="mrow__pending-dot" />}
    </span>
  )
}

export function ModuleRow({ module, label, you, partner, action, onPress }: ModuleRowProps) {
  const Wrapper = onPress ? 'button' : 'div'
  return (
    <div className="mrow">
      <Wrapper
        type={onPress ? 'button' : undefined}
        className={`mrow__main ${onPress ? 'mrow__main--pressable' : ''}`}
        onClick={onPress}
      >
        <span className="mrow__lead">
          <span className="mrow__icon">
            <ModuleIcon module={module} size={18} />
          </span>
          <span className="mrow__label">{label}</span>
        </span>

        <span className="mrow__sides">
          <span className="mrow__side mrow__side--you">
            <StatusDot done={you.done} />
            <span className="mrow__value">{you.value}</span>
          </span>
          <span className="mrow__divider" aria-hidden="true" />
          <span className="mrow__side mrow__side--partner">
            <StatusDot done={partner?.done ?? false} />
            <span className="mrow__value">{partner ? partner.value : '—'}</span>
          </span>
        </span>
      </Wrapper>

      {action && <div className="mrow__action">{action}</div>}
    </div>
  )
}
