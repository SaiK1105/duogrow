import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ isNativePlatform: vi.fn() }))
vi.mock('./lib/platform', () => platform)

// Onboarding is the '/' route; stub it so this exercises the shell, not a screen.
vi.mock('./screens/Onboarding', () => ({ Onboarding: () => <p>onboarding stub</p> }))

const { default: App } = await import('./App')

function renderApp() {
  return render(
    <HashRouter>
      <App />
    </HashRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('app shell', () => {
  it('draws the simulated phone frame on the web', () => {
    platform.isNativePlatform.mockReturnValue(false)

    const { container } = renderApp()

    expect(screen.getByText('onboarding stub')).toBeInTheDocument()
    expect(container.querySelector('.phone-frame')).not.toBeNull()
    expect(container.querySelector('.native-shell')).toBeNull()
  })

  it('drops the fake bezel, fake clock and ambient backdrop on a native shell', () => {
    platform.isNativePlatform.mockReturnValue(true)

    const { container } = renderApp()

    // The same screen renders — only the chrome around it changes.
    expect(screen.getByText('onboarding stub')).toBeInTheDocument()
    expect(container.querySelector('.native-shell')).not.toBeNull()
    expect(container.querySelector('.phone-frame')).toBeNull()
    expect(container.querySelector('.phone-statusbar')).toBeNull()
    expect(container.querySelector('.ambient')).toBeNull()
  })
})
