import { Route, Routes, useLocation } from 'react-router-dom'
import { AmbientBackdrop } from './components/AmbientBackdrop'
import { PhoneFrame } from './components/PhoneFrame'
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

function App() {
  const location = useLocation()
  const showTabs = TAB_ROUTES.includes(location.pathname)

  return (
    <>
      <AmbientBackdrop />
      <PhoneFrame>
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
      </PhoneFrame>
    </>
  )
}

export default App
