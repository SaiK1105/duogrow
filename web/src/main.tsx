import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/global.css'
import './styles/ui.css'
import { ToastProvider } from './components/Toast'
import { hydrateToken } from './api/tokenStore'
import App from './App'

// Hydration must finish before the first render. Native token storage is async,
// and a screen that mounts mid-hydration reads an empty token — indistinguishable
// from being signed out, so the app would bounce a signed-in person to onboarding.
await hydrateToken()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
)
