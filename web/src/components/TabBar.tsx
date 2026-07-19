import { NavLink, useNavigate } from 'react-router-dom'
import { HomeIcon, InsightsIcon, PlusIcon, PotdIcon, ProfileIcon } from './icons'
import './tab-bar.css'

interface TabDef {
  to: string
  label: string
  Icon: (p: { size?: number }) => React.ReactElement
}

const LEFT: TabDef[] = [
  { to: '/today', label: 'Home', Icon: HomeIcon },
  { to: '/potd', label: 'POTD', Icon: PotdIcon },
]

const RIGHT: TabDef[] = [
  { to: '/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

function Tab({ to, label, Icon }: TabDef) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `tab ${isActive ? 'tab--active' : ''}`}
    >
      <span className="tab__icon">
        <Icon size={22} />
      </span>
      <span className="tab__label">{label}</span>
    </NavLink>
  )
}

export function TabBar() {
  const navigate = useNavigate()

  return (
    <nav className="tab-bar" aria-label="Primary">
      <div className="tab-bar__pill">
        {LEFT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}

        <button
          type="button"
          className="tab-fab"
          onClick={() => navigate('/upload')}
          aria-label="Upload proof"
        >
          <PlusIcon size={26} />
        </button>

        {RIGHT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}
