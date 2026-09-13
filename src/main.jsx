import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerServiceWorker } from '@/lib/pushClient'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Registra o service worker do PWA (necessário para instalar e para push).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch(() => {})
  })
}
