import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './components/AuthGate'
import { initSync } from './lib/sync'
import './styles.css'

initSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)

/**
 * Register the worker that makes the app open without a network. Deliberately
 * after load, so it never competes with the first paint, and silent on failure
 * — an app that works offline is better than one that complains it can't.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Resolved against the document, not the module: `base` is './' so the
    // build has to work from a subpath, and import.meta.url would point into
    // the assets folder where there is no worker.
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* No offline support here; everything else still works. */
    })
  })
}
