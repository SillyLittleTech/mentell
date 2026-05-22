import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './shared/theme/ThemeProvider.tsx'
import { SettingsProvider } from './shared/settings/SettingsProvider.tsx'
import { AuthProvider } from './shared/firebase/AuthProvider.tsx'
import { DebugAuthProvider } from './shared/firebase/DebugAuthProvider.tsx'
import { isDebugMode } from './shared/debug/debugFlags.ts'
import { isFirebaseEnabled } from './shared/features/featureFlags.ts'
import { registerSW } from 'virtual:pwa-register'

if (!isDebugMode()) {
  registerSW({ immediate: true })
}

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

const app = (
  <BrowserRouter basename={routerBasename}>
    <App />
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        {isFirebaseEnabled() ? (
          isDebugMode() ? (
            <DebugAuthProvider>{app}</DebugAuthProvider>
          ) : (
            <AuthProvider>{app}</AuthProvider>
          )
        ) : (
          app
        )}
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)
