import './streak-flame.css'

interface StreakFlameProps {
  count: number
  size?: number
  active?: boolean
}

export function StreakFlame({ count, size = 22, active = true }: StreakFlameProps) {
  return (
    <span className={`streak ${active ? 'streak--active' : 'streak--idle'}`}>
      <svg
        className="streak__flame"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 2c1.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.2.4-2 1-2.8.2 1.4 1 2 1.8 2 .9 0 1.4-.7 1.2-1.9C11.2 5.6 12 3.6 12 2Z"
          fill="currentColor"
        />
      </svg>
      <span className="streak__count">{count}</span>
      <span className="streak__unit">day{count === 1 ? '' : 's'}</span>
    </span>
  )
}
