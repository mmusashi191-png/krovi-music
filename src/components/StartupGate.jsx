import { useEffect, useState } from 'react'
import StartupScreen from './StartupScreen.jsx'

export default function StartupGate({ children }) {
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
      {children}
      {visible && <StartupScreen exiting={exiting} />}
    </>
  )
}
