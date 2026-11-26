import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { installKeyboardLang } from './lib/keyboard'
import './styles.css'

// The installed Android app ships its files inside the APK: a service worker would only
// risk serving an older cached copy after an update.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true })
installKeyboardLang()

// Ask the browser not to evict our data (granted heuristically, e.g. for installed apps).
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
