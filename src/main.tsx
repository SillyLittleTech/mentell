import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './shared/theme/ThemeProvider.tsx'
import { SettingsProvider } from './shared/settings/SettingsProvider.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <BrowserRouter basename={routerBasename}>
          <App />
        </BrowserRouter>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)
