const CLIENT_ID_KEY = 'krovi-connect-client-v3'

let socket = null
let socketPromise = null
let desiredRoomCode = ''
const listeners = new Set()
const snapshots = new Map()

export const connectConfigMessage = 'Connect is unavailable. Check the hosted WebSocket configuration.'

function getClientId() {
  let id = window.sessionStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = 'guest-' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now())
    window.sessionStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}

function getWebSocketUrl() {
  const configured = String(import.meta.env.VITE_CONNECT_WS_URL || '').trim().replace(/\/$/, '')
  if (configured) return configured

  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return protocol + '://' + host + ':8787/ws'
  }

  throw new Error(connectConfigMessage)
}

function notify(message) {
  if (
    message.type === 'error' &&
    ['ROOM_NOT_FOUND', 'ROOM_FULL', 'INVALID_ROOM_CODE'].includes(message.code)
  ) {
    desiredRoomCode = ''
    if (message.roomCode) snapshots.delete(message.roomCode)
  }

  listeners.forEach((listener) => listener(message))
}

function attachSocketEvents(nextSocket) {
  nextSocket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data)
      if (message.type === 'room-state' && message.roomCode) {
        snapshots.set(message.roomCode, message)
      }
      notify(message)
    } catch {
      notify({ type: 'error', code: 'INVALID_SERVER_MESSAGE', message: 'Connect returned an invalid response.' })
    }
  })

  nextSocket.addEventListener('close', () => {
    if (socket === nextSocket) socket = null
    socketPromise = null
    notify({ type: 'connection-state', state: 'disconnected', message: connectConfigMessage })

    if (!desiredRoomCode) return

    window.setTimeout(() => {
      if (desiredRoomCode && !socket) {
        connectSocket().catch(() => {})
      }
    }, 1200)
  })

  nextSocket.addEventListener('error', () => {
    notify({ type: 'connection-state', state: 'error', message: connectConfigMessage })
  })
}

function connectSocket() {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (socketPromise) return socketPromise

  socketPromise = new Promise((resolve, reject) => {
    let settled = false
    let timeoutId
    let nextSocket

    try {
      nextSocket = new WebSocket(getWebSocketUrl())
    } catch (error) {
      socketPromise = null
      reject(error)
      return
    }

    notify({ type: 'connection-state', state: 'connecting' })

    timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      socketPromise = null
      nextSocket.close()
      reject(new Error(connectConfigMessage))
    }, 12000)

    nextSocket.addEventListener('open', () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      socket = nextSocket
      socketPromise = null
      attachSocketEvents(nextSocket)
      notify({ type: 'connection-state', state: 'connected' })

      if (desiredRoomCode) {
        nextSocket.send(JSON.stringify({
          type: 'join-room',
          roomCode: desiredRoomCode,
          clientId: getClientId(),
          reconnect: true,
        }))
      }

      resolve(nextSocket)
    }, { once: true })

    nextSocket.addEventListener('error', () => {
      if (!settled) {
        settled = true
        window.clearTimeout(timeoutId)
        socketPromise = null
        reject(new Error(connectConfigMessage))
      }
    }, { once: true })
  })

  return socketPromise
}

function request(message, expectedType) {
  return connectSocket().then((activeSocket) => new Promise((resolve, reject) => {
    let finished = false

    const cleanup = () => listeners.delete(handleMessage)
    const handleMessage = (response) => {
      if (finished) return
      if (response.type === expectedType) {
        finished = true
        cleanup()
        resolve(response)
      } else if (response.type === 'error') {
        finished = true
        cleanup()
        const error = new Error(response.message || connectConfigMessage)
        error.code = response.code
        reject(error)
      }
    }

    listeners.add(handleMessage)

    try {
      activeSocket.send(JSON.stringify({
        ...message,
        clientId: getClientId(),
      }))
    } catch (error) {
      finished = true
      cleanup()
      reject(error)
    }

    window.setTimeout(() => {
      if (finished) return
      finished = true
      cleanup()
      reject(new Error(connectConfigMessage))
    }, 12000)
  }))
}

export async function createRoom(playback = {}) {
  desiredRoomCode = ''
  const response = await request({ type: 'create-room', playback }, 'room-state')
  desiredRoomCode = response.roomCode
  return {
    roomCode: response.roomCode,
    clientId: getClientId(),
    role: response.role,
    participantCount: response.participantCount || 1,
  }
}

export async function joinRoom(roomCode) {
  desiredRoomCode = ''
  const normalizedCode = String(roomCode || '').trim().toUpperCase()
  const response = await request({ type: 'join-room', roomCode: normalizedCode }, 'room-state')
  desiredRoomCode = response.roomCode
  return {
    roomCode: response.roomCode,
    clientId: getClientId(),
    role: response.role,
    participantCount: response.participantCount || 2,
  }
}

export function subscribeToRoom(roomCode, onMessage) {
  const listener = (message) => {
    if (message.type === 'error') {
      onMessage(message)
      return
    }
    if (message.type === 'room-state' && message.roomCode === roomCode) onMessage(message)
    if (message.type === 'playback-state' && message.roomCode === roomCode) onMessage(message)
    if (message.type === 'queue-state' && message.roomCode === roomCode) onMessage(message)
    if (message.type === 'presence-state' && message.roomCode === roomCode) onMessage(message)
    if (message.type === 'chat-message' && message.roomCode === roomCode) onMessage(message)
  }

  listeners.add(listener)

  if (snapshots.has(roomCode)) onMessage(snapshots.get(roomCode))

  return () => listeners.delete(listener)
}

export function subscribeToConnection(onState) {
  const listener = (message) => {
    if (message.type === 'connection-state') onState(message)
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updatePlaybackState(roomCode, playback, options = {}) {
  return connectSocket().then((activeSocket) => {
    const command = options.command || 'playback'
    const shouldCarrySeek = command === 'seek' || command === 'track'
    activeSocket.send(JSON.stringify({
      type: 'playback-update',
      roomCode,
      clientId: getClientId(),
      activeVideoId: playback.currentTrack?.videoId || '',
      activeVideoMetadata: playback.currentTrack || null,
      isPlaying: Boolean(playback.isPlaying),
      playbackPosition: Math.max(0, Number(playback.currentTime) || 0),
      command,
      seekId: shouldCarrySeek ? (crypto.randomUUID?.() || String(Date.now())) : null,
      seekPosition: shouldCarrySeek && Number.isFinite(options.seekPosition)
        ? Math.max(0, Number(options.seekPosition))
        : null,
    }))
  })
}

export function updateQueue(roomCode, queue) {
  return connectSocket().then((activeSocket) => {
    activeSocket.send(JSON.stringify({
      type: 'queue-update',
      roomCode,
      clientId: getClientId(),
      queue: Array.isArray(queue) ? queue : [],
    }))
  })
}

export function sendChatMessage(roomCode, text) {
  const message = String(text || '').trim().slice(0, 280)
  if (!message) return Promise.resolve()
  return connectSocket().then((activeSocket) => {
    activeSocket.send(JSON.stringify({
      type: 'chat-message',
      roomCode,
      clientId: getClientId(),
      text: message,
    }))
  })
}

export function leaveRoom() {
  const previousRoomCode = desiredRoomCode
  desiredRoomCode = ''
  if (previousRoomCode) snapshots.delete(previousRoomCode)
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ type: 'leave-room', clientId: getClientId() }))
    } catch {
      // The socket may already be closing.
    }
  }
  socket?.close()
  socket = null
  socketPromise = null
}
