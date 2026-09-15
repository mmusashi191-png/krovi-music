const CLIENT_ID_STORAGE_KEY = 'krovi-connect-client-v1'

let socket
let socketPromise
const messageListeners = new Set()
const roomSnapshots = new Map()

export const isConnectConfigured = true
export const connectConfigMessage = 'Connect server is unavailable. Start the Krovi server and try again.'

function getClientId() {
  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (stored) return stored
  const clientId = `guest-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId)
  return clientId
}

function websocketUrl() {
  const configuredUrl = import.meta.env.VITE_CONNECT_WS_URL
  if (configuredUrl) return configuredUrl
  if (window.location.port === '5173') return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8787/ws`
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
}

function notify(message) {
  messageListeners.forEach((listener) => listener(message))
}

function connectSocket() {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (socketPromise) return socketPromise
  socketPromise = new Promise((resolve, reject) => {
    const nextSocket = new WebSocket(websocketUrl())
    const timeout = window.setTimeout(() => { nextSocket.close(); reject(new Error(connectConfigMessage)) }, 5000)
    nextSocket.addEventListener('open', () => { window.clearTimeout(timeout); socket = nextSocket; socketPromise = null; resolve(nextSocket) }, { once: true })
    nextSocket.addEventListener('error', () => { window.clearTimeout(timeout); socketPromise = null; reject(new Error(connectConfigMessage)) }, { once: true })
    nextSocket.addEventListener('message', (event) => { try { const message = JSON.parse(event.data); if (message.type === 'room-state' && message.roomCode) roomSnapshots.set(message.roomCode, message); notify(message) } catch { notify({ type: 'error', message: 'The Connect server sent an invalid response.' }) } })
    nextSocket.addEventListener('close', () => { if (socket === nextSocket) socket = null; notify({ type: 'error', code: 'SERVER_UNAVAILABLE', message: connectConfigMessage }) })
  })
  return socketPromise
}

function request(message, expectedType) {
  return connectSocket().then((activeSocket) => new Promise((resolve, reject) => {
    const handleMessage = (response) => {
      if (response.type === expectedType) { messageListeners.delete(handleMessage); resolve(response) }
      else if (response.type === 'error') { messageListeners.delete(handleMessage); const error = new Error(response.message); error.code = response.code; reject(error) }
    }
    messageListeners.add(handleMessage)
    activeSocket.send(JSON.stringify({ ...message, clientId: getClientId() }))
  }))
}

export async function createRoom(playback = {}) {
  const response = await request({ type: 'create-room', playback }, 'room-state')
  return { roomCode: response.roomCode, clientId: getClientId(), role: response.role }
}

export async function joinRoom(roomCode) {
  const response = await request({ type: 'join-room', roomCode }, 'room-state')
  return { roomCode: response.roomCode, clientId: getClientId(), role: response.role }
}

export function subscribeToRoom(roomCode, onRoom) {
  const listener = (message) => { if (message.type === 'error') onRoom(message); else if (message.type === 'room-state' && message.roomCode === roomCode) onRoom(message) }
  messageListeners.add(listener)
  if (roomSnapshots.has(roomCode)) onRoom(roomSnapshots.get(roomCode))
  return () => messageListeners.delete(listener)
}

export function subscribeToPresence(roomCode, onPresence) {
  const listener = (message) => { if (message.type === 'presence-update' && message.roomCode === roomCode) onPresence(message) }
  messageListeners.add(listener)
  return () => messageListeners.delete(listener)
}

export function updatePlaybackState(roomCode, playback) {
  return connectSocket().then((activeSocket) => activeSocket.send(JSON.stringify({ type: 'playback-update', roomCode, clientId: getClientId(), activeVideoId: playback.currentTrack?.videoId || '', activeVideoMetadata: playback.currentTrack || null, isPlaying: Boolean(playback.isPlaying), playbackPosition: Number(playback.currentTime) || 0 })))
}

export function updateQueue(roomCode, queue) {
  return connectSocket().then((activeSocket) => activeSocket.send(JSON.stringify({ type: 'queue-update', roomCode, clientId: getClientId(), queue: Array.isArray(queue) ? queue : [] })))
}

export async function leaveRoom() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave-room', clientId: getClientId() }))
}
