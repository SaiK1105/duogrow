import { useEffect, useState } from 'react'
import './phone-frame.css'

function useClock(): string {
  const [time, setTime] = useState(() => currentTime())
  useEffect(() => {
    const id = window.setInterval(() => setTime(currentTime()), 15000)
    return () => window.clearInterval(id)
  }, [])
  return time
}

function currentTime(): string {
  const d = new Date()
  const h = d.getHours() % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Centered phone column on the ambient backdrop. Bezel + faux status bar on
 * viewports >= 480px; frameless (true mobile-web) below that.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const time = useClock()

  return (
    <div className="phone-shell">
      <div className="phone-frame">
        <div className="phone-statusbar" aria-hidden="true">
          <span className="phone-statusbar__time">{time}</span>
          <span className="phone-statusbar__glyphs">
            <span className="glyph-signal" />
            <span className="glyph-wifi" />
            <span className="glyph-battery" />
          </span>
        </div>
        <div className="phone-viewport">{children}</div>
      </div>
    </div>
  )
}
