const CLIENT_ID_STORAGE_KEY = 'krovi-connect-client-v2'

let socket = null
let socketPromise = null
const messageListeners = new Set()
const roomSnapshots = new Map()

export const isConnectConfigured = true
export const connectConfigMessage = 'Connect is unavailable right now. Check the hosted server connection and try again.'

function getClientId() {
  let stored = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (!stored) {
    stored = `guest-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, stored)
  }
  return stored
}

function websocketUrl() {
  const configuredUrl = String(import.meta.env.VITE_CONNECT_WS_URL || '').trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${protocol}//${window.location.hostname}:8787/ws`
  }
  return `${protocol}//${window.location.host}/ws`
}

function notify(message) {
  messageListeners.forEach((listener) => listener(message))
}

function closeSocket() {
  if (socket) {
    socket.close()
    socket = null
  }
  socketPromise = null
}

function connectSocket() {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (socketPromise) return socketPromise

  socketPromise = new Promise((resolve, reject) => {
    let settled = false
    const nextSocket = new WebSocket(websocketUrl())
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      nextSocket.close()
      socketPromise = null
      reject(new Error(connectConfigMessage))
    }, 12000)

    nextSocket.addEventListener('open', () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      socket = nextSocket
      socketPromise = null
      resolve(nextSocket)
    }, { once: true })

    nextSocket.addEventListener('error', () => {
      if (!settled) {
        settled = true
        window.clearTimeout(timeout)
        socketPromise = null
        reject(new Error(connectConfigMessage))
      }
    }, { once: true })

    nextSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'room-state' && message.roomCode) roomSnapshots.set(message.roomCode, message)
        notify(message)
      } catch {
        notify({ type: 'error', message: 'Connect returned an invalid response.' })
      }
    })

    nextSocket.addEventListener('close', () => {
      if (socket === nextSocket) socket = null
      socketPromise = null
      notify({ type: 'error', code: 'SERVER_UNAVAILABLE', message: connectConfigMessage })
    })
  })

  return socketPromise
}

function request(message, expectedType) {
  return connectSocket().then((activeSocket) => new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => messageListeners.delete(handleMessage)
    const handleMessage = (response) => {
      if (settled) return
      if (response.type === expectedType) {
        settled = true
        cleanup()
        resolve(response)
      } else if (response.type === 'error') {
        settled = true
        cleanup()
        const error = new Error(response.message || connectConfigMessage)
        error.code = response.code
        reject(error)
      }
    }
    messageListeners.add(handleMessage)
    try {
      activeSocket.send(JSON.stringify({ ...message, clientId: getClientId() }))
    } catch (error) {
      settled = true
      cleanup()
      reject(error)
    }
  }))
}

export async function createRoom(playback = {}) {
  const response = await request({ type: 'create-room', playback }, 'room-state')
  return { roomCode: response.roomCode, clientId: getClientId(), role: response.role }
}

export async function joinRoom(roomCode) {
  const normalizedCode = String(roomCode || '').trim().toUpperCase()
  const response = await request({ type: 'join-room', roomCode: normalizedCode }, 'room-state')
  return { roomCode: response.roomCode, clientId: getClientId(), role: response.role }
}

export function subscribeToRoom(roomCode, onRoom) {
  const listener = (message) => {
    if (message.type === 'error') onRoom(message)
    else if (message.type === 'room-state' && message.roomCode === roomCode) onRoom(message)
  }
  messageListeners.add(listener)
  if (roomSnapshots.has(roomCode)) onRoom(roomSnapshots.get(roomCode))
  return () => messageListeners.delete(listener)
}

export function updatePlaybackState(roomCode, playback, options = {}) {
  const seekPosition = Number.isFinite(options.seekPosition) ? Math.max(0, options.seekPosition) : null
  return connectSocket().then((activeSocket) => {
    activeSocket.send(JSON.stringify({
      type: 'playback-update',
      roomCode,
      clientId: getClientId(),
      activeVideoId: playback.currentTrack?.videoId || '',
      activeVideoMetadata: playback.currentTrack || null,
      isPlaying: Boolean(playback.isPlaying),
      playbackPosition: Math.max(0, Number(playback.currentTime) || 0),
      command: options.command || 'playback',
      seekId: options.command === 'seek' || options.command === 'track' ? crypto.randomUUID?.() || String(Date.now()) : null,
      seekPosition,
    }))
  })
}

export function sendChatMessage(roomCode, text) {
  const message = String(text || '').trim().slice(0, 280)
  if (!message) return Promise.resolve()
  return connectSocket().then((activeSocket) => activeSocket.send(JSON.stringify({
    type: 'chat-message',
    roomCode,
    clientId: getClientId(),
    text: message,
  })))
}

export function leaveRoom() {
  if (socket?.readyState === WebSocket.OPEN) {
    try { socket.send(JSON.stringify({ type: 'leave-room', clientId: getClientId() })) } catch { /* socket is already closing */ }
  }
  closeSocket()
}
