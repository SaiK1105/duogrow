import { Capacitor } from '@capacitor/core'

/**
 * True only inside a Capacitor native shell (iOS or Android), false in any
 * browser — including a mobile browser. Capacitor reports "web" when its
 * runtime is present but no native bridge is, so this stays correct for the
 * ordinary web build even though the library is bundled.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}
