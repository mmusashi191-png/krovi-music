const express = require('express')
const dotenv = require('dotenv')
const http = require('http')
const crypto = require('crypto')
const { WebSocketServer, WebSocket } = require('ws')

dotenv.config()

const app = express()
const youtubeSearchEndpoint = 'https://www.googleapis.com/youtube/v3/search'
const rooms = new Map()
const clients = new Map()
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const searchCache = new Map()
const SEARCH_CACHE_TTL = 30_000
const SEARCH_CACHE_LIMIT = 100

app.disable('x-powered-by')

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }
  next()
})

app.use(express.json({ limit: '100kb' }))

app.get('/health', (_request, response) => response.json({
  ok: true,
  service: 'krovi-music-api',
  rooms: rooms.size,
}))

function createRoomCode() {
  let roomCode
  do {
    roomCode = Array.from({ length: 6 }, () => (
      roomCodeAlphabet[Math.floor(Math.random() * roomCodeAlphabet.length)]
    )).join('')
  } while (rooms.has(roomCode))
  return roomCode
}

function normalizeTrack(track) {
  if (!track || typeof track !== 'object' || !track.videoId || !track.title) return null
  return {
    videoId: String(track.videoId).slice(0, 30),
    title: String(track.title).slice(0, 200),
    artist: String(track.artist || 'YouTube').slice(0, 120),
    thumbnail: typeof track.thumbnail === 'string' ? track.thumbnail.slice(0, 500) : '',
    duration: typeof track.duration === 'string' ? track.duration.slice(0, 20) : '',
  }
}

function cleanQueue(queue) {
  if (!Array.isArray(queue)) return []
  const seen = new Set()
  return queue.map(normalizeTrack).filter((track) => {
    if (!track || seen.has(track.videoId)) return false
    seen.add(track.videoId)
    return true
  }).slice(0, 100)
}

function roomState(room) {
  return {
    type: 'room-state',
    roomCode: room.roomCode,
    role: null,
    participantCount: room.participants.size,
    activeVideoId: room.activeVideoId,
    activeVideoMetadata: room.activeVideoMetadata,
    isPlaying: room.isPlaying,
    playbackPosition: room.playbackPosition,
    updatedAt: room.updatedAt,
    queue: room.queue,
    chatMessages: room.chatMessages,
    version: room.version,
  }
}

function send(client, message) {
  if (client?.socket?.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message))
  }
}

function broadcast(room, message, excludedClientId = null) {
  for (const clientId of room.participants) {
    if (clientId !== excludedClientId) send(clients.get(clientId), message)
  }
}

function broadcastPresence(room) {
  broadcast(room, {
    type: 'presence-state',
    roomCode: room.roomCode,
    participantCount: room.participants.size,
  })
}

function removeClientFromRoom(client) {
  if (!client?.roomCode) return
  const room = rooms.get(client.roomCode)
  if (!room) {
    client.roomCode = null
    return
  }

  room.participants.delete(client.clientId)
  client.roomCode = null

  if (!room.participants.size) {
    rooms.delete(room.roomCode)
    return
  }

  broadcastPresence(room)
}

function makeRoom(playback, hostClientId) {
  const track = normalizeTrack(playback?.currentTrack)
  return {
    roomCode: createRoomCode(),
    hostClientId,
    participants: new Set([hostClientId]),
    activeVideoId: track?.videoId || '',
    activeVideoMetadata: track,
    isPlaying: Boolean(playback?.isPlaying),
    playbackPosition: Math.max(0, Number(playback?.currentTime) || 0),
    updatedAt: Date.now(),
    queue: cleanQueue(playback?.queue),
    chatMessages: [],
    version: 0,
    restLastSeen: new Map(),
  }
}

function handleRoomMessage(client, message) {
  if (typeof message?.clientId === 'string' && message.clientId.trim()) {
    const requestedId = message.clientId.trim().slice(0, 100)
    if (requestedId !== client.clientId) {
      clients.delete(client.clientId)
      client.clientId = requestedId
      clients.set(client.clientId, client)
    }
  }

  const type = message?.type

  if (type === 'create-room') {
    removeClientFromRoom(client)

    const room = makeRoom(message.playback, client.clientId)
    rooms.set(room.roomCode, room)
    client.roomCode = room.roomCode

    send(client, { ...roomState(room), role: 'host' })
    broadcastPresence(room)
    return
  }

  if (type === 'join-room') {
    const roomCode = String(message.roomCode || '').trim().toUpperCase()

    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      send(client, { type: 'error', code: 'INVALID_ROOM_CODE', message: 'Enter a valid 6-character room code.' })
      return
    }

    const room = rooms.get(roomCode)
    if (!room) {
      send(client, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'That room is no longer available.' })
      return
    }

    if (!room.participants.has(client.clientId) && room.participants.size >= 2) {
      send(client, { type: 'error', code: 'ROOM_FULL', message: 'This listening room already has two listeners.' })
      return
    }

    removeClientFromRoom(client)
    room.participants.add(client.clientId)
    client.roomCode = room.roomCode

    send(client, { ...roomState(room), role: room.hostClientId === client.clientId ? 'host' : 'guest' })
    broadcastPresence(room)
    return
  }

  if (type === 'leave-room') {
    removeClientFromRoom(client)
    send(client, { type: 'left-room' })
    return
  }

  const room = client.roomCode ? rooms.get(client.roomCode) : null
  if (!room) {
    send(client, { type: 'error', code: 'NOT_IN_ROOM', message: 'Join a room before sending updates.' })
    return
  }

  if (type === 'playback-update') {
    const track = normalizeTrack(message.activeVideoMetadata)

    room.activeVideoId = typeof message.activeVideoId === 'string' ? message.activeVideoId.slice(0, 30) : track?.videoId || ''
    room.activeVideoMetadata = track
    room.isPlaying = Boolean(message.isPlaying)
    room.playbackPosition = Math.max(0, Number(message.playbackPosition) || 0)
    room.updatedAt = Date.now()
    room.version += 1

    const command = ['track', 'playback', 'seek'].includes(message.command) ? message.command : 'playback'
    const seekPosition = Number.isFinite(Number(message.seekPosition))
      ? Math.max(0, Number(message.seekPosition))
      : null
    const seekId = typeof message.seekId === 'string' ? message.seekId.slice(0, 100) : null

    broadcast(room, {
      type: 'playback-state',
      roomCode: room.roomCode,
      activeVideoId: room.activeVideoId,
      activeVideoMetadata: room.activeVideoMetadata,
      isPlaying: room.isPlaying,
      playbackPosition: room.playbackPosition,
      updatedAt: room.updatedAt,
      command,
      seekId,
      seekPosition,
      version: room.version,
    }, client.clientId)
    return
  }

  if (type === 'queue-update') {
    room.queue = cleanQueue(message.queue)
    room.updatedAt = Date.now()
    room.version += 1

    broadcast(room, {
      type: 'queue-state',
      roomCode: room.roomCode,
      queue: room.queue,
      version: room.version,
    }, client.clientId)
    return
  }

  if (type === 'chat-message') {
    const text = String(message.text || '').trim().slice(0, 280)
    if (!text) return

    const chatMessage = {
      id: crypto.randomUUID(),
      clientId: client.clientId,
      text,
      sentAt: Date.now(),
    }

    room.chatMessages = [...room.chatMessages, chatMessage].slice(-50)

    broadcast(room, {
      type: 'chat-message',
      roomCode: room.roomCode,
      message: chatMessage,
    }, null)
    return
  }

  send(client, { type: 'error', code: 'UNKNOWN_MESSAGE', message: 'That Connect action is not supported.' })
}


function normalizeRestClientId(value) {
  const clientId = String(value || '').trim()
  return clientId ? clientId.slice(0, 100) : ''
}

function removeRestParticipant(room, clientId) {
  if (!room) return

  room.participants.delete(clientId)
  room.restLastSeen?.delete(clientId)

  if (!room.participants.size) {
    rooms.delete(room.roomCode)
    return
  }

  broadcastPresence(room)
}

function detachParticipantEverywhere(clientId) {
  for (const room of rooms.values()) {
    if (!room.participants.has(clientId)) continue
    if (clients.has(clientId)) continue
    removeRestParticipant(room, clientId)
  }
}

function getRestRoom(request, response) {
  const roomCode = String(request.params.roomCode || '').trim().toUpperCase()
  const clientId = normalizeRestClientId(request.body?.clientId || request.query?.clientId)

  if (!/^[A-Z0-9]{6}$/.test(roomCode) || !clientId) {
    response.status(400).json({
      code: 'INVALID_CONNECT_REQUEST',
      message: 'Connect request is invalid.',
    })
    return null
  }

  const room = rooms.get(roomCode)

  if (!room) {
    response.status(404).json({
      code: 'ROOM_NOT_FOUND',
      message: 'That room is no longer available.',
    })
    return null
  }

  if (!room.participants.has(clientId)) {
    response.status(403).json({
      code: 'NOT_IN_ROOM',
      message: 'Join this room before sending updates.',
    })
    return null
  }

  room.restLastSeen?.set(clientId, Date.now())
  return { room, clientId }
}

app.post('/api/connect/rooms', (request, response) => {
  const clientId = normalizeRestClientId(request.body?.clientId)

  if (!clientId) {
    response.status(400).json({
      code: 'INVALID_CLIENT',
      message: 'Connect could not identify this listener.',
    })
    return
  }

  detachParticipantEverywhere(clientId)

  const room = makeRoom(request.body?.playback, clientId)
  room.restLastSeen.set(clientId, Date.now())
  rooms.set(room.roomCode, room)

  response.status(201).json({
    ...roomState(room),
    role: 'host',
  })
})

app.post('/api/connect/rooms/:roomCode/join', (request, response) => {
  const roomCode = String(request.params.roomCode || '').trim().toUpperCase()
  const clientId = normalizeRestClientId(request.body?.clientId)

  if (!/^[A-Z0-9]{6}$/.test(roomCode) || !clientId) {
    response.status(400).json({
      code: 'INVALID_CONNECT_REQUEST',
      message: 'Enter a valid 6-character room code.',
    })
    return
  }

  const room = rooms.get(roomCode)

  if (!room) {
    response.status(404).json({
      code: 'ROOM_NOT_FOUND',
      message: 'That room is no longer available.',
    })
    return
  }

  if (!room.participants.has(clientId) && room.participants.size >= 2) {
    response.status(409).json({
      code: 'ROOM_FULL',
      message: 'This listening room already has two listeners.',
    })
    return
  }

  detachParticipantEverywhere(clientId)
  room.participants.add(clientId)
  room.restLastSeen.set(clientId, Date.now())

  response.json({
    ...roomState(room),
    role: room.hostClientId === clientId ? 'host' : 'guest',
  })
})

app.get('/api/connect/rooms/:roomCode/state', (request, response) => {
  const result = getRestRoom(request, response)
  if (!result) return

  response.json(roomState(result.room))
})

app.post('/api/connect/rooms/:roomCode/playback', (request, response) => {
  const result = getRestRoom(request, response)
  if (!result) return

  const { room, clientId } = result
  const track = normalizeTrack(request.body?.activeVideoMetadata)

  room.activeVideoId = typeof request.body?.activeVideoId === 'string'
    ? request.body.activeVideoId.slice(0, 30)
    : track?.videoId || ''
  room.activeVideoMetadata = track
  room.isPlaying = Boolean(request.body?.isPlaying)
  room.playbackPosition = Math.max(0, Number(request.body?.playbackPosition) || 0)
  room.updatedAt = Date.now()
  room.version += 1

  const command = ['track', 'playback', 'seek'].includes(request.body?.command)
    ? request.body.command
    : 'playback'

  const seekPosition = Number.isFinite(Number(request.body?.seekPosition))
    ? Math.max(0, Number(request.body.seekPosition))
    : null

  broadcast(room, {
    type: 'playback-state',
    roomCode: room.roomCode,
    activeVideoId: room.activeVideoId,
    activeVideoMetadata: room.activeVideoMetadata,
    isPlaying: room.isPlaying,
    playbackPosition: room.playbackPosition,
    updatedAt: room.updatedAt,
    command,
    seekId: (command === 'track' || command === 'seek') ? crypto.randomUUID() : null,
    seekPosition,
    version: room.version,
  }, clientId)

  response.json(roomState(room))
})

app.post('/api/connect/rooms/:roomCode/queue', (request, response) => {
  const result = getRestRoom(request, response)
  if (!result) return

  const { room, clientId } = result
  room.queue = cleanQueue(request.body?.queue)
  room.updatedAt = Date.now()
  room.version += 1

  broadcast(room, {
    type: 'queue-state',
    roomCode: room.roomCode,
    queue: room.queue,
    version: room.version,
  }, clientId)

  response.json(roomState(room))
})

app.post('/api/connect/rooms/:roomCode/chat', (request, response) => {
  const result = getRestRoom(request, response)
  if (!result) return

  const { room, clientId } = result
  const text = String(request.body?.text || '').trim().slice(0, 280)

  if (!text) {
    response.status(400).json({
      code: 'EMPTY_MESSAGE',
      message: 'Write a message before sending it.',
    })
    return
  }

  const chatMessage = {
    id: crypto.randomUUID(),
    clientId,
    text,
    sentAt: Date.now(),
  }

  room.chatMessages = [...room.chatMessages, chatMessage].slice(-50)

  broadcast(room, {
    type: 'chat-message',
    roomCode: room.roomCode,
    message: chatMessage,
  })

  response.json(chatMessage)
})

app.post('/api/connect/rooms/:roomCode/leave', (request, response) => {
  const result = getRestRoom(request, response)
  if (!result) return

  removeRestParticipant(result.room, result.clientId)
  response.json({ type: 'left-room' })
})

app.get('/api/youtube/search', async (request, response) => {
  const query = String(request.query.q || '').trim()

  if (!process.env.YOUTUBE_API_KEY) {
    response.status(500).json({ error: 'YouTube search is not configured on the server.' })
    return
  }

  if (query.length < 2) {
    response.status(400).json({ error: 'Search requires at least two characters.' })
    return
  }

  const cacheKey = query.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    response.json({ results: cached.results, cached: true })
    return
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '10',
    q: query,
    key: process.env.YOUTUBE_API_KEY,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const youtubeResponse = await fetch(youtubeSearchEndpoint + '?' + params, { signal: controller.signal })
    const payload = await youtubeResponse.json()

    if (!youtubeResponse.ok) {
      response.status(youtubeResponse.status >= 500 ? 502 : youtubeResponse.status).json({
        error: payload.error?.message || 'YouTube search failed.',
      })
      return
    }

    const results = (payload.items || [])
      .map((item) => ({
        id: { videoId: item.id?.videoId },
        snippet: {
          title: item.snippet?.title,
          channelTitle: item.snippet?.channelTitle || 'YouTube channel',
          thumbnails: item.snippet?.thumbnails || {},
        },
      }))
      .filter((item) => item.id.videoId && item.snippet.title)

    searchCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL,
      results,
    })

    while (searchCache.size > SEARCH_CACHE_LIMIT) {
      searchCache.delete(searchCache.keys().next().value)
    }

    response.json({ results })
  } catch (error) {
    response.status(error.name === 'AbortError' ? 504 : 502).json({
      error: error.name === 'AbortError' ? 'YouTube took too long to respond.' : 'Unable to reach YouTube.',
    })
  } finally {
    clearTimeout(timeout)
  }
})

const server = http.createServer(app)
const websocketServer = new WebSocketServer({ server, path: '/ws' })

websocketServer.on('connection', (socket) => {
  const client = {
    socket,
    clientId: crypto.randomUUID(),
    roomCode: null,
    isAlive: true,
  }

  clients.set(client.clientId, client)

  socket.on('pong', () => {
    client.isAlive = true
  })

  socket.on('message', (rawMessage) => {
    try {
      handleRoomMessage(client, JSON.parse(rawMessage.toString()))
    } catch {
      send(client, { type: 'error', code: 'INVALID_MESSAGE', message: 'Connect received invalid data.' })
    }
  })

  const cleanupClient = () => {
    // A reconnect can reuse the same client id. Never let the old socket
    // remove the room membership or client registry entry of the new socket.
    if (clients.get(client.clientId) !== client) return
    removeClientFromRoom(client)
    clients.delete(client.clientId)
  }

  socket.on('close', cleanupClient)
  socket.on('error', cleanupClient)
})

const restPresenceCleanup = setInterval(() => {
  const now = Date.now()

  for (const room of rooms.values()) {
    for (const [clientId, lastSeen] of room.restLastSeen || []) {
      if (clients.has(clientId)) continue
      if (now - lastSeen <= 15_000) continue

      room.participants.delete(clientId)
      room.restLastSeen.delete(clientId)
      broadcastPresence(room)
    }

    if (!room.participants.size) {
      rooms.delete(room.roomCode)
    }
  }
}, 5_000)

restPresenceCleanup.unref?.()

const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (!client.isAlive) {
      client.socket.terminate()
      continue
    }
    client.isAlive = false
    client.socket.ping()
  }
}, 25_000)

heartbeat.unref?.()

const PORT = Number(process.env.PORT) || 8787

server.listen(PORT, '0.0.0.0', () => {
  console.log('Krovi server listening on ' + PORT)
})

function shutdown() {
  clearInterval(heartbeat)
  clearInterval(restPresenceCleanup)
  websocketServer.close()
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
