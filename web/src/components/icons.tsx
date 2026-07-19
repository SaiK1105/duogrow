import type { RowKey } from '../lib/format'

interface IconProps {
  size?: number
  className?: string
}

// Shared stroke-icon wrapper. Icons inherit color via currentColor.
function Svg({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function WakeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13" r="6" />
      <path d="M12 10v3l1.8 1.2M12 3v2M4.5 5.5l1 1M19.5 5.5l-1 1" />
    </Svg>
  )
}

export function StudyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6.5 12 4l9 2.5M3 6.5v9L12 18l9-2.5v-9M12 8v10" />
    </Svg>
  )
}

export function WorkoutIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />
    </Svg>
  )
}

export function DietIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21c-3.5-2-6-5-6-9a6 6 0 0 1 12 0c0 4-2.5 7-6 9Z" />
      <path d="M12 12c0-2 1-3.5 3-4" />
    </Svg>
  )
}

export function TasksIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h13M4 12h13M4 17h9" />
      <path d="M20 6.5 21 7.5 20 8.5" />
    </Svg>
  )
}

export function PotdIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 9a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3 1-1.3 1.9v.4" />
      <circle cx="11.5" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Svg>
  )
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function MinusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" />
    </Svg>
  )
}

export function InsightsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />
    </Svg>
  )
}

export function ProfileIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </Svg>
  )
}

export function UploadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16V5M8 8.5 12 4.5 16 8.5M5 19h14" />
    </Svg>
  )
}

export function BackIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 6l-6 6 6 6" />
    </Svg>
  )
}

export function CopyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Svg>
  )
}

export function BulbIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 17h6M10 20h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2H9.5c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3Z" />
    </Svg>
  )
}

export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 15h4M9 20h6M12 15v2" />
    </Svg>
  )
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 21 19H3L12 4ZM12 10v4" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

const ROW_ICONS: Record<RowKey, (p: IconProps) => React.ReactElement> = {
  wake: WakeIcon,
  study: StudyIcon,
  workout: WorkoutIcon,
  diet: DietIcon,
  tasks: TasksIcon,
  potd: PotdIcon,
}

export function ModuleIcon({ module, ...rest }: IconProps & { module: RowKey }) {
  const Comp = ROW_ICONS[module]
  return <Comp {...rest} />
}
