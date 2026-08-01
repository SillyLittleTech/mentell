import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRouter } from './AppRouter.tsx'
import { ThemeProvider } from './shared/theme/ThemeProvider.tsx'
import { SettingsProvider } from './shared/settings/SettingsProvider.tsx'
import { AuthProvider } from './shared/firebase/AuthProvider.tsx'
import { DebugAuthProvider } from './shared/firebase/DebugAuthProvider.tsx'
import { isDebugMode } from './shared/debug/debugFlags.ts'
import { isFirebaseEnabled, shouldUseDebugAuthProvider } from './shared/features/featureFlags.ts'
import { isOfflineZipBuild } from './shared/platform/runtime.ts'
import { isWebPushConfigured } from './pwa/pushSubscribe.ts'
import { registerDebugPushServiceWorker } from './pwa/registerDebugPushSw.ts'
import { registerSW } from 'virtual:pwa-register'
import { ToastProvider } from './shared/ui/ToastProvider.tsx'

if (!isOfflineZipBuild()) {
  if (isDebugMode()) {
    if (isWebPushConfigured()) {
      void registerDebugPushServiceWorker()
    }
  } else {
    registerSW({ immediate: true })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SettingsProvider>
          {isFirebaseEnabled() ? (
            shouldUseDebugAuthProvider() ? (
              <DebugAuthProvider>
                <AppRouter />
              </DebugAuthProvider>
            ) : (
              <AuthProvider>
                <AppRouter />
              </AuthProvider>
            )
          ) : (
            <AppRouter />
          )}
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
