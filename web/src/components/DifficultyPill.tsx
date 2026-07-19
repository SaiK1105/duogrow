import './difficulty-pill.css'

interface DifficultyPillProps {
  level: string
}

export function DifficultyPill({ level }: DifficultyPillProps) {
  const normalized = level.toLowerCase()
  const cls =
    normalized === 'easy'
      ? 'easy'
      : normalized === 'hard'
        ? 'hard'
        : 'medium'
  return <span className={`diff-pill diff-pill--${cls}`}>{level}</span>
}
