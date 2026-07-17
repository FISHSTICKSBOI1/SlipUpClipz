import { useEffect } from 'react'
import { AppSettingsProvider } from './context/AppSettingsContext'
import { ClipLibraryProvider } from './context/ClipLibraryContext'
import { LicenseProvider } from './context/LicenseContext'
import { OnboardingTourProvider } from './context/OnboardingTourContext'
import { ReplayBufferProvider } from './context/ReplayBufferContext'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { OnboardingTourOverlay } from './components/onboarding/OnboardingTourOverlay'
import { preloadUISounds } from './lib/uiSounds'
import { HomePage } from './pages/HomePage'
import { ClipsPage } from './pages/ClipsPage'
import { SoundboardPage } from './pages/SoundboardPage'
import { SettingsPage } from './pages/SettingsPage'

function UISoundsWarmup() {
  useEffect(() => {
    const warm = () => preloadUISounds()
    window.addEventListener('pointerdown', warm, { once: true })
    window.addEventListener('keydown', warm, { once: true })
    return () => {
      window.removeEventListener('pointerdown', warm)
      window.removeEventListener('keydown', warm)
    }
  }, [])
  return null
}

export default function App() {
  return (
    <LicenseProvider>
      <AppSettingsProvider>
        <UISoundsWarmup />
        <ClipLibraryProvider>
          <ReplayBufferProvider>
            <OnboardingTourProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="clips" element={<ClipsPage />} />
                  <Route path="soundboard" element={<SoundboardPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
              <OnboardingTourOverlay />
            </OnboardingTourProvider>
          </ReplayBufferProvider>
        </ClipLibraryProvider>
      </AppSettingsProvider>
    </LicenseProvider>
  )
}
