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
import { isWebPushConfigured } from './pwa/pushSubscribe.ts'
import { registerDebugPushServiceWorker } from './pwa/registerDebugPushSw.ts'
import { registerSW } from 'virtual:pwa-register'
import { ToastProvider } from './shared/ui/ToastProvider.tsx'
import { ToastContainer } from './shared/ui/ToastContainer.tsx'
import { OfflineSyncManager } from './shared/offline/OfflineSyncManager.tsx'
import { UpdateChecker } from './features/update/UpdateChecker.tsx'

if (isDebugMode()) {
  if (isWebPushConfigured()) {
    void registerDebugPushServiceWorker()
  }
} else {
  registerSW({ immediate: true })
}

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

const app = (
  <BrowserRouter basename={routerBasename}>
    <App />
    <ToastContainer />
    <OfflineSyncManager />
    <UpdateChecker />
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
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
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
