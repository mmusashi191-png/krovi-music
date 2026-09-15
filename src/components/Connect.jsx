import { useState } from 'react'
import { Check, Copy, Link, Users, X } from 'lucide-react'

export default function Connect({ room, isConfigured, error, onCreate, onJoin, onLeave, onClose }) {
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  const handleJoin = async (event) => {
    event.preventDefault()
    setIsJoining(true)
    try { await onJoin(roomCode) } finally { setIsJoining(false) }
  }

  const copyRoomCode = async () => {
    if (!room?.roomCode) return
    await navigator.clipboard?.writeText(room.roomCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return <div className="connect-backdrop" role="presentation" onClick={onClose}><section className="connect-sheet" role="dialog" aria-modal="true" aria-label="Connect listening room" onClick={(event) => event.stopPropagation()}><header className="connect-header"><div><p className="eyebrow">CONNECT</p><h2>Listen together</h2></div><button type="button" className="modal-close" aria-label="Close Connect" onClick={onClose}><X size={22} /></button></header>{room ? <div className="connect-room"><div className="connect-room-icon"><Users size={22} /></div><p className="connect-status"><span className="connect-dot" /> Connected · {room.participantCount || 1} listener{room.participantCount === 1 ? '' : 's'}</p><p className="connect-label">ROOM CODE</p><div className="connect-code-row"><strong>{room.roomCode}</strong><button type="button" className="connect-copy" aria-label="Copy room code" onClick={copyRoomCode}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><p className="connect-help">Share this code with someone you trust.</p><button type="button" className="modal-secondary-action connect-leave" onClick={onLeave}>Leave room</button></div> : <><div className="connect-intro"><Link size={20} /><p>Create a private room or join one with a code. Your local player stays in control when you are not connected.</p></div><button type="button" className="primary-button connect-create" onClick={onCreate} disabled={!isConfigured}>Create a room</button><div className="connect-divider"><span>OR JOIN A ROOM</span></div><form className="connect-join-form" onSubmit={handleJoin}><label htmlFor="connect-room-code">Room code</label><div><input id="connect-room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" maxLength={6} autoComplete="off" /><button type="submit" className="primary-button" disabled={!isConfigured || roomCode.length !== 6 || isJoining}>Join</button></div></form></>}{!isConfigured && <p className="connect-error">Connect server is unavailable. Start the Krovi server to enable rooms.</p>}{error && <p className="connect-error">{error}</p>}</section></div>
}
