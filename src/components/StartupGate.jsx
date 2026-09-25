import { useEffect, useState } from 'react'
import StartupScreen from './StartupScreen.jsx'

export default function StartupGate({ children }) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 1650)
    const removeTimer = window.setTimeout(() => setVisible(false), 2140)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  return (
    <>
      {children}
      {visible && <StartupScreen exiting={exiting} />}
    </>
  )
}
