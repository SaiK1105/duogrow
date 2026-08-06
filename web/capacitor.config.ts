import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.duogrow.app',
  appName: 'DuoGrow',
  webDir: 'dist',
  server: {
    // Serves the webview from https://localhost on Android rather than
    // http://localhost. That origin is what the server's CORS allow-list
    // expects, and it keeps the app on a secure context so browser APIs that
    // require one keep working. iOS uses capacitor://localhost, which is also
    // on the allow-list.
    androidScheme: 'https',
  },
}

export default config
