import { useEffect, useState } from 'react'
import StartupScreen from './StartupScreen.jsx'

export default function StartupGate({ children }) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 1120)
    const removeTimer = window.setTimeout(() => setVisible(false), 1560)

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
