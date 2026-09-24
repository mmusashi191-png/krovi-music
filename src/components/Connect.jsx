import { useEffect, useState } from 'react'
import { Check, Copy, Link2, Send, Users, X } from 'lucide-react'

export default function Connect({
  room,
  status,
  error,
  chatMessages,
  onCreate,
  onJoin,
  onLeave,
  onSendChat,
  onClose,
}) {
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleCreate = async () => {
    setBusy(true)
    try {
      await onCreate()
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await onJoin(roomCode)
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    if (!room?.roomCode) return
    await navigator.clipboard?.writeText(room.roomCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const value = message.trim()
    if (!value) return
    setMessage('')
    await onSendChat(value)
  }

  const connectionLabel = status === 'connecting'
    ? 'Connecting'
    : status === 'connected'
      ? 'Live'
      : status === 'disconnected' || status === 'error'
        ? 'Offline'
        : 'Ready'

  return (
    <div className="modal-backdrop connect-backdrop" onClick={onClose}>
      <section className={'connect-sheet ' + (room ? 'has-room' : '')} role="dialog" aria-modal="true" aria-label="Connect listening room" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">CONNECT</p>
            <h2>Listen together.</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close Connect" onClick={onClose}><X size={20} /></button>
        </header>

        {room ? (
          <div className="room-content">
            <div className="room-hero">
              <div className="room-symbol"><Link2 size={23} /></div>
              <div>
                <p className="connection-status"><span className={'status-dot ' + status} /> {connectionLabel} · {room.participantCount || 1}/2 listeners</p>
                <h3>{room.role === 'host' ? 'Your listening room' : 'You joined a room'}</h3>
              </div>
            </div>

            <div className="room-code-card">
              <span>ROOM CODE</span>
              <strong>{room.roomCode}</strong>
              <button type="button" className="room-copy" onClick={copyCode}>
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="chat-panel">
              <header>
                <div><p className="eyebrow">ROOM CHAT</p><strong>Say something.</strong></div>
                <Users size={17} />
              </header>

              <div className="chat-list" aria-live="polite">
                {chatMessages.length ? chatMessages.map((item) => (
                  <div className="chat-message" key={item.id}>
                    <small>{item.clientId === room.clientId ? 'You' : 'Listener'}</small>
                    <p>{item.text}</p>
                  </div>
                )) : (
                  <p className="chat-empty">No messages yet.</p>
                )}
              </div>

              <form className="chat-form" onSubmit={sendMessage}>
                <input
                  value={message}
                  maxLength={280}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message..."
                  aria-label="Room chat message"
                />
                <button type="submit" aria-label="Send message" disabled={!message.trim()}>
                  <Send size={17} />
                </button>
              </form>
            </div>

            <p className="room-note">Both listeners can control playback. The room is limited to two people.</p>
            <button type="button" className="danger-link" onClick={onLeave}>Leave room</button>
          </div>
        ) : (
          <div className="connect-entry-panel">
            <div className="connect-intro">
              <Link2 size={20} />
              <div>
                <h3>Share a listening room</h3>
                <p>Create a room, send the code to one person, and control the same playback together.</p>
              </div>
            </div>

            <button type="button" className="primary-button large-action" onClick={handleCreate} disabled={busy || status === 'connecting'}>
              {busy ? 'Connecting…' : 'Create a room'}
              {!busy && <span>→</span>}
            </button>

            <div className="or-line"><span>OR</span></div>

            <form className="join-form" onSubmit={handleJoin}>
              <label htmlFor="room-code">Enter room code</label>
              <div>
                <input
                  id="room-code"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  inputMode="text"
                  maxLength={6}
                  autoComplete="off"
                />
                <button type="submit" className="secondary-button" disabled={busy || roomCode.length !== 6}>
                  Join
                </button>
              </div>
            </form>

            <p className="connect-note">Your music stays local unless you enter a room. Connect only shares playback, queue, presence, and chat.</p>
          </div>
        )}

        {error && <p className="connect-error">{error}</p>}
      </section>
    </div>
  )
}
