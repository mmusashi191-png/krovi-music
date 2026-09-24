import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StartupScreen from './components/StartupScreen.jsx'

function StartupGate() {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 920)
    const removeTimer = window.setTimeout(() => setVisible(false), 1320)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  return (
    <>
      <App />
      {visible && <StartupScreen exiting={exiting} />}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StartupGate />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
