import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AmbientBackdrop } from './components/AmbientBackdrop'
import { PhoneFrame } from './components/PhoneFrame'
import { NativeShell } from './components/NativeShell'
import { isNativePlatform } from './lib/platform'
import { TabBar } from './components/TabBar'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Upload } from './screens/Upload'
import { VerifyResult } from './screens/VerifyResult'
import { Potd } from './screens/Potd'
import { Insights } from './screens/Insights'
import { Profile } from './screens/Profile'

// Screens that show the floating tab bar.
const TAB_ROUTES = ['/today', '/potd', '/insights', '/profile', '/upload']

// Desktop-only analytics surface. It is deliberately absent from TAB_ROUTES and
// code-split: the bundle is already at budget and gets wrapped into the native
// mobile apps, where this route is unreachable and must not cost anything.
const DASHBOARD_ROUTE = '/dashboard'
const Dashboard = lazy(() =>
  import('./screens/Dashboard').then((module) => ({ default: module.Dashboard })),
)

function App() {
  const location = useLocation()
  const showTabs = TAB_ROUTES.includes(location.pathname)

  // The dashboard renders outside AmbientBackdrop/PhoneFrame — it is a wide
  // desktop page, not a phone screen.
  if (location.pathname === DASHBOARD_ROUTE) {
    return (
      <Suspense fallback={<p className="screen">Loading dashboard…</p>}>
        <Dashboard />
      </Suspense>
    )
  }

  // On a native shell the device already provides the bezel and the status bar,
  // so PhoneFrame would draw a fake phone (and a fake clock) inside a real one.
  // The screens themselves are unchanged; only the chrome around them differs.
  const Shell = isNativePlatform() ? NativeShell : PhoneFrame

  return (
    <>
      {!isNativePlatform() && <AmbientBackdrop />}
      <Shell>
        <div className="screen-scroll">
          <Routes>
            <Route path="/" element={<Onboarding />} />
            <Route path="/today" element={<Today />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/verify/:id" element={<VerifyResult />} />
            <Route path="/potd" element={<Potd />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Onboarding />} />
          </Routes>
          {showTabs && <TabBar />}
        </div>
      </Shell>
    </>
  )
}

export default App
