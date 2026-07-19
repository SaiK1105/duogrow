import './ambient-backdrop.css'

/**
 * Two soft radial glow blobs (green + amber) drifting slowly behind the phone
 * column. Pure transform loops — never opacity flicker on the whole page.
 */
export function AmbientBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient__blob ambient__blob--green" />
      <span className="ambient__blob ambient__blob--amber" />
      <span className="ambient__grain" />
    </div>
  )
}
