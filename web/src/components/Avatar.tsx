import { initials } from '../lib/format'
import './avatar.css'

type AvatarTone = 'you' | 'partner' | 'neutral'

interface AvatarProps {
  name: string
  tone?: AvatarTone
  size?: number
  ring?: boolean
}

export function Avatar({ name, tone = 'you', size = 40, ring = false }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${tone} ${ring ? 'avatar--ring' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
