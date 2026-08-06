import type { ReactNode } from 'react'
import './native-shell.css'

interface NativeShellProps {
  children: ReactNode
}

/**
 * The native counterpart to PhoneFrame. On a device the hardware supplies the
 * bezel and the OS supplies the status bar, so this draws neither — it only
 * reserves the real safe areas (notch, home indicator) that PhoneFrame faked.
 */
export function NativeShell({ children }: NativeShellProps) {
  return <div className="native-shell">{children}</div>
}
