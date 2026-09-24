import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2, Send, Users, X } from 'lucide-react'

export default function Connect({ room, error, chatMessages = [], onCreate, onJoin, onLeave, onSendChat, onClose }) {
  const [roomCode, setRoomCode] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [chatMessages.length])

  const handleJoin = async (event) => {
    event.preventDefault()
    setBusy(true)
    try { await onJoin(roomCode) } finally { setBusy(false) }
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    setMessage('')
    await onSendChat(text)
  }

  const copyRoomCode = async () => {
    if (!room?.roomCode) return
    try { await navigator.clipboard.writeText(room.roomCode) } catch { return }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="connect-backdrop" role="presentation" onClick={onClose}>
      <section className="connect-sheet" role="dialog" aria-modal="true" aria-label="Connect listening room" onClick={(event) => event.stopPropagation()}>
        <header className="connect-header">
          <div><p className="eyebrow">CONNECT</p><h2>Listen together.</h2></div>
          <button type="button" className="modal-close" aria-label="Close Connect" onClick={onClose}><X size={20} /></button>
        </header>

        {!room ? (
          <div className="connect-setup">
            <div className="connect-intro"><span><Link2 size={19} /></span><p>A private two-person room. Both listeners control the same player.</p></div>
            <button type="button" className="primary-button connect-create" onClick={onCreate} disabled={busy}>Create a room</button>
            <div className="connect-divider"><span>OR JOIN</span></div>
            <form className="connect-join-form" onSubmit={handleJoin}>
              <label htmlFor="connect-room-code">Six-character room code</label>
              <div><input id="connect-room-code" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" maxLength={6} autoComplete="off" /><button type="submit" className="primary-button" disabled={roomCode.length !== 6 || busy}>Join</button></div>
            </form>
          </div>
        ) : (
          <div className="connect-room">
            <div className="connect-room-top">
              <div className="connect-room-icon"><Users size={20} /></div>
              <div><strong>Room is live</strong><span><i /> {room.participantCount || 1} listener{room.participantCount === 1 ? '' : 's'}</span></div>
            </div>
            <div className="connect-code-card">
              <span>ROOM CODE</span>
              <strong>{room.roomCode}</strong>
              <button type="button" onClick={copyRoomCode}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="connect-chat" aria-label="Room chat">
              <div className="connect-chat-head"><span>Room chat</span><small>{chatMessages.length}/50</small></div>
              <div className="connect-chat-list">
                {chatMessages.length ? chatMessages.map((item) => <p key={item.id || `${item.sentAt}-${item.text}`}><span>{item.text}</span></p>) : <div className="chat-empty">Send a message while you listen.</div>}
                <span ref={chatEndRef} />
              </div>
              <form className="connect-chat-form" onSubmit={handleSend}><input value={message} onChange={(event) => setMessage(event.target.value.slice(0, 280))} placeholder="Say something..." maxLength={280} /><button type="submit" aria-label="Send message"><Send size={16} /></button></form>
            </div>
            <button type="button" className="modal-secondary-action connect-leave" onClick={onLeave}>Leave room</button>
          </div>
        )}
        {error && <p className="connect-error">{error}</p>}
      </section>
    </div>
  )
}
