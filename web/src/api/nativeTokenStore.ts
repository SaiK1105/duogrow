import { Preferences } from '@capacitor/preferences'
import type { PersistentTokenStore } from './tokenStore'

const TOKEN_KEY = 'duogrow.session'

/**
 * Native session storage, registered into the tokenStore seam at startup.
 *
 * Capacitor Preferences persists to UserDefaults on iOS and SharedPreferences
 * on Android, both of which survive the webview being torn down — which is the
 * whole point, since sessionStorage does not.
 *
 * This module is imported dynamically so @capacitor/preferences never lands in
 * the web bundle, where it would be dead weight.
 */
export const capacitorTokenStore: PersistentTokenStore = {
  async load() {
    const { value } = await Preferences.get({ key: TOKEN_KEY })
    return value ?? null
  },
  async save(token: string) {
    await Preferences.set({ key: TOKEN_KEY, value: token })
  },
  async clear() {
    await Preferences.remove({ key: TOKEN_KEY })
  },
}
