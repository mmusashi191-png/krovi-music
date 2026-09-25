import { Capacitor } from '@capacitor/core'

const CLIENT_ID_KEY = 'krovi-connect-client-v4'
const DEFAULT_CONNECT_URL = 'wss://krovi-music.onrender.com/ws'
const DEFAULT_HTTP_URL = 'https://krovi-music.onrender.com'

let socket = null
let socketPromise = null
let desiredRoomCode = ''
let reconnectTimer = null
let httpPollTimer = null
let httpPollBusy = false
let transportMode = 'ws'
const listeners = new Set()
const snapshots = new Map()

export const connectConfigMessage = 'Connect is unavailable. Check the network connection and try again.'

function getClientId() {
  let id = window.sessionStorage.getItem(CLIENT_ID_KEY)

  if (!id) {
    id = 'guest-' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now())
    window.sessionStorage.setItem(CLIENT_ID_KEY, id)
  }

  return id
}

function getHttpBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

  if (
    import.meta.env.PROD
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)
  ) {
    return DEFAULT_HTTP_URL
  }

  return configured || DEFAULT_HTTP_URL
}

function getWebSocketUrl() {
  const configured = String(import.meta.env.VITE_CONNECT_WS_URL || '').trim().replace(/\/$/, '')
  const isStaleProductionLocalUrl = import.meta.env.PROD
    && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configured)

  if (configured && !isStaleProductionLocalUrl) return configured

  const isNativeApp = Capacitor.isNativePlatform()
  const host = window.location.hostname

  if (!isNativeApp && (host === 'localhost' || host === '127.0.0.1')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return protocol + '://' + host + ':8787/ws'
  }

  return DEFAULT_CONNECT_URL
}

function notify(message) {
  if (
    message.type === 'error'
    && ['ROOM_NOT_FOUND', 'ROOM_FULL', 'INVALID_ROOM_CODE'].includes(message.code)
  ) {
    desiredRoomCode = ''
  }

  listeners.forEach((listener) => listener(message))
}

function scheduleReconnect() {
  if (!desiredRoomCode || reconnectTimer || (socket && socket.readyState === WebSocket.OPEN)) return

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null

    if (transportMode === 'http') {
      pollHttpRoom().catch(() => scheduleReconnect())
      return
    }

    if (desiredRoomCode && !socket && !socketPromise) {
      connectSocket().catch(() => scheduleReconnect())
    }
  }, 1800)
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
      notify({
        type: 'error',
        code: 'INVALID_SERVER_MESSAGE',
        message: 'Connect returned an invalid response.',
      })
    }
  })

  nextSocket.addEventListener('close', (event) => {
    if (socket === nextSocket) socket = null
    socketPromise = null

    const detail = event.code && event.code !== 1000
      ? 'Connect closed the socket (code ' + event.code + ').'
      : connectConfigMessage

    notify({
      type: 'connection-state',
      state: 'disconnected',
      message: detail,
    })

    scheduleReconnect()
  })

  nextSocket.addEventListener('error', () => {
    notify({
      type: 'connection-state',
      state: 'error',
      message: connectConfigMessage,
    })
  })
}

async function requestHttp(path, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(getHttpBaseUrl() + path, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(payload.message || payload.error || connectConfigMessage)
      error.code = payload.code || 'CONNECT_HTTP_ERROR'
      error.status = response.status
      throw error
    }

    return payload
  } finally {
    window.clearTimeout(timeout)
  }
}

async function warmHostedService() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(getHttpBaseUrl() + '/health', {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) throw new Error('Hosted service unavailable.')
  } finally {
    window.clearTimeout(timeout)
  }
}

function stopHttpPolling() {
  if (httpPollTimer) {
    window.clearInterval(httpPollTimer)
    httpPollTimer = null
  }

  httpPollBusy = false
}

async function pollHttpRoom() {
  if (!desiredRoomCode || transportMode !== 'http' || httpPollBusy) return

  httpPollBusy = true

  try {
    const response = await requestHttp(
      '/api/connect/rooms/' + encodeURIComponent(desiredRoomCode) + '/state?clientId=' + encodeURIComponent(getClientId()),
      { method: 'GET' },
    )

    const signature = JSON.stringify([
      response.participantCount,
      response.activeVideoId,
      response.activeVideoMetadata?.videoId || '',
      response.isPlaying,
      response.playbackPosition,
      response.updatedAt,
      response.version,
      response.queue,
      response.chatMessages,
    ])

    if (snapshots.get(desiredRoomCode)?.__httpSignature !== signature) {
      const snapshot = {
        ...response,
        type: 'room-state',
        role: null,
        __httpSignature: signature,
      }

      snapshots.set(desiredRoomCode, snapshot)
      notify(snapshot)
    }

    notify({ type: 'connection-state', state: 'connected' })
  } catch (error) {
    const code = error?.code

    if (code === 'ROOM_NOT_FOUND' || code === 'NOT_IN_ROOM') {
      stopHttpPolling()
      notify({
        type: 'error',
        code,
        message: error.message,
      })
      return
    }

    notify({
      type: 'connection-state',
      state: 'disconnected',
      message: 'Connect is reconnecting…',
    })
    scheduleReconnect()
  } finally {
    httpPollBusy = false
  }
}

function startHttpPolling(roomCode) {
  stopHttpPolling()
  desiredRoomCode = roomCode
  transportMode = 'http'

  pollHttpRoom().catch(() => {})

  httpPollTimer = window.setInterval(() => {
    pollHttpRoom().catch(() => {})
  }, 650)
}

function connectSocket() {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (socketPromise) return socketPromise

  socketPromise = new Promise((resolve, reject) => {
    let settled = false
    let timeoutId

    try {
      const nextSocket = new WebSocket(getWebSocketUrl())

      notify({ type: 'connection-state', state: 'connecting' })

      timeoutId = window.setTimeout(() => {
        if (settled) return

        settled = true
        socketPromise = null
        nextSocket.close()
        reject(new Error(connectConfigMessage))
      }, 20_000)

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
    } catch (error) {
      socketPromise = null
      reject(error)
    }
  })

  return socketPromise
}

async function createRoomHttp(playback = {}) {
  await warmHostedService()

  const response = await requestHttp('/api/connect/rooms', {
    method: 'POST',
    body: JSON.stringify({
      clientId: getClientId(),
      playback,
    }),
  })

  desiredRoomCode = response.roomCode
  snapshots.delete(response.roomCode)

  startHttpPolling(response.roomCode)
  notify({ type: 'connection-state', state: 'connected' })

  return {
    roomCode: response.roomCode,
    clientId: getClientId(),
    role: response.role,
    participantCount: response.participantCount || 1,
  }
}

async function joinRoomHttp(roomCode) {
  await warmHostedService()

  const response = await requestHttp(
    '/api/connect/rooms/' + encodeURIComponent(roomCode) + '/join',
    {
      method: 'POST',
      body: JSON.stringify({ clientId: getClientId() }),
    },
  )

  desiredRoomCode = response.roomCode
  snapshots.delete(response.roomCode)

  startHttpPolling(response.roomCode)
  notify({ type: 'connection-state', state: 'connected' })

  return {
    roomCode: response.roomCode,
    clientId: getClientId(),
    role: response.role,
    participantCount: response.participantCount || 2,
  }
}

function requestSocket(message, expectedType) {
  return connectSocket().then((activeSocket) => new Promise((resolve, reject) => {
    let finished = false

    const cleanup = () => listeners.delete(handleMessage)
    const handleMessage = (response) => {
      if (finished) return

      if (response.type === expectedType) {
        finished = true
        cleanup()
        resolve(response)
        return
      }

      if (response.type === 'error') {
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
      return
    }

    window.setTimeout(() => {
      if (finished) return
      finished = true
      cleanup()
      reject(new Error(connectConfigMessage))
    }, 12_000)
  }))
}

export async function createRoom(playback = {}) {
  if (Capacitor.isNativePlatform()) {
    try {
      return await createRoomHttp(playback)
    } catch (error) {
      transportMode = 'ws'
      try {
        return await createRoomViaSocket(playback)
      } catch {
        throw error
      }
    }
  }

  return createRoomViaSocket(playback)
}

async function createRoomViaSocket(playback) {
  stopHttpPolling()
  transportMode = 'ws'
  desiredRoomCode = ''

  const response = await requestSocket({ type: 'create-room', playback }, 'room-state')
  desiredRoomCode = response.roomCode

  return {
    roomCode: response.roomCode,
    clientId: getClientId(),
    role: response.role,
    participantCount: response.participantCount || 1,
  }
}

export async function joinRoom(roomCode) {
  const normalizedCode = String(roomCode || '').trim().toUpperCase()

  if (Capacitor.isNativePlatform()) {
    try {
      return await joinRoomHttp(normalizedCode)
    } catch (error) {
      transportMode = 'ws'
      try {
        return await joinRoomViaSocket(normalizedCode)
      } catch {
        throw error
      }
    }
  }

  return joinRoomViaSocket(normalizedCode)
}

async function joinRoomViaSocket(roomCode) {
  stopHttpPolling()
  transportMode = 'ws'
  desiredRoomCode = ''

  const response = await requestSocket({ type: 'join-room', roomCode }, 'room-state')
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
    if (message.type === 'error') onMessage(message)

    if (message.roomCode !== roomCode) return

    if (
      message.type === 'room-state'
      || message.type === 'playback-state'
      || message.type === 'queue-state'
      || message.type === 'presence-state'
      || message.type === 'presence-update'
      || message.type === 'chat-message'
    ) {
      onMessage(message)
    }
  }

  listeners.add(listener)

  if (snapshots.has(roomCode)) {
    onMessage(snapshots.get(roomCode))
  }

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
  const command = options.command || 'playback'
  const payload = {
    clientId: getClientId(),
    activeVideoId: playback.currentTrack?.videoId || '',
    activeVideoMetadata: playback.currentTrack || null,
    isPlaying: Boolean(playback.isPlaying),
    playbackPosition: Math.max(0, Number(playback.currentTime) || 0),
    command,
    seekPosition: (command === 'seek' || command === 'track') && Number.isFinite(options.seekPosition)
      ? Math.max(0, Number(options.seekPosition))
      : null,
  }

  if (transportMode === 'http') {
    return requestHttp(
      '/api/connect/rooms/' + encodeURIComponent(roomCode) + '/playback',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  }

  return connectSocket().then((activeSocket) => {
    activeSocket.send(JSON.stringify({
      type: 'playback-update',
      roomCode,
      clientId: getClientId(),
      activeVideoId: payload.activeVideoId,
      activeVideoMetadata: payload.activeVideoMetadata,
      isPlaying: payload.isPlaying,
      playbackPosition: payload.playbackPosition,
      command: payload.command,
      seekId: (command === 'seek' || command === 'track')
        ? (crypto.randomUUID?.() || String(Date.now()))
        : null,
      seekPosition: payload.seekPosition,
    }))
  })
}

export function updateQueue(roomCode, queue) {
  if (transportMode === 'http') {
    return requestHttp(
      '/api/connect/rooms/' + encodeURIComponent(roomCode) + '/queue',
      {
        method: 'POST',
        body: JSON.stringify({
          clientId: getClientId(),
          queue: Array.isArray(queue) ? queue : [],
        }),
      },
    )
  }

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

  if (transportMode === 'http') {
    return requestHttp(
      '/api/connect/rooms/' + encodeURIComponent(roomCode) + '/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          clientId: getClientId(),
          text: message,
        }),
      },
    )
  }

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
  stopHttpPolling()

  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (previousRoomCode && transportMode === 'http') {
    requestHttp(
      '/api/connect/rooms/' + encodeURIComponent(previousRoomCode) + '/leave',
      {
        method: 'POST',
        body: JSON.stringify({ clientId: getClientId() }),
      },
    ).catch(() => {})
  }

  if (socket?.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({
        type: 'leave-room',
        clientId: getClientId(),
      }))
    } catch {
      // The socket may already be closing.
    }
  }

  socket?.close()
  socket = null
  socketPromise = null
  transportMode = 'ws'
}
