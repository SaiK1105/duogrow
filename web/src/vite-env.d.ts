/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the DuoGrow API, e.g. `https://duogrow.onrender.com`, with no
   * trailing path. Leave unset for web builds: production serves the SPA and the
   * API from one origin, so requests stay relative. Capacitor builds must set it
   * — a relative path inside a webview resolves against the app bundle.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
