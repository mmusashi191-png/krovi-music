const express = require('express')
const dotenv = require('dotenv')
const http = require('http')
const crypto = require('crypto')
const { WebSocketServer, WebSocket } = require('ws')

dotenv.config()

const app = express()

// Allow the Krovi Capacitor Android app to call this API.
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204)
  }

  next()
})
const port = 8787
const youtubeSearchEndpoint = 'https://www.googleapis.com/youtube/v3/search'
const rooms = new Map()
const clients = new Map()
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createRoomCode() {
  let roomCode
  do roomCode = Array.from({ length: 6 }, () => roomCodeAlphabet[Math.floor(Math.random() * roomCodeAlphabet.length)]).join('')
  while (rooms.has(roomCode))
  return roomCode
}

function send(client, message) {
  if (client?.socket?.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message))
}

function roomState(room) {
  return { roomCode: room.roomCode, hostClientId: room.hostClientId, participantCount: room.participants.size, activeVideoId: room.activeVideoId, activeVideoMetadata: room.activeVideoMetadata, isPlaying: room.isPlaying, playbackPosition: room.playbackPosition, chatMessages: Array.isArray(room.chatMessages) ? room.chatMessages : [], queue: room.queue, updatedAt: room.updatedAt, syncVersion: room.syncVersion, seekId: room.seekId, seekPosition: room.seekPosition }
}

function broadcast(room, message, excludedClientId = null) {
  room.participants.forEach((clientId) => { if (clientId !== excludedClientId) send(clients.get(clientId), message) })
}

function broadcastPresence(room) {
  broadcast(room, { type: 'presence-update', roomCode: room.roomCode, participantCount: room.participants.size })
}

function removeClientFromRoom(client) {
  if (!client.roomCode) return
  const room = rooms.get(client.roomCode)
  if (!room) return
  room.participants.delete(client.clientId)
  client.roomCode = null
  if (room.hostClientId === client.clientId) room.hostClientId = room.participants.values().next().value || null
  if (!room.participants.size) rooms.delete(room.roomCode)
  else broadcastPresence(room)
}

function handleRoomMessage(client, message) {
  if (typeof message?.clientId === 'string' && message.clientId.length > 0 && message.clientId !== client.clientId) {
    clients.delete(client.clientId)
    client.clientId = message.clientId.slice(0, 100)
    clients.set(client.clientId, client)
  }
  const type = message?.type
  if (type === 'create-room') {
    removeClientFromRoom(client)
    const room = {
      roomCode: createRoomCode(),
      hostClientId: client.clientId,
      participants: new Set([client.clientId]),
      activeVideoId: message.playback?.currentTrack?.videoId || '',
      activeVideoMetadata: message.playback?.currentTrack || null,
      isPlaying: Boolean(message.playback?.isPlaying),
      playbackPosition: Number(message.playback?.currentTime) || 0,
      queue: Array.isArray(message.playback?.queue) ? message.playback.queue : [],
      chatMessages: [],
      updatedAt: Date.now(),
      syncVersion: 0,
      seekId: null,
      seekPosition: null,
    }
    rooms.set(room.roomCode, room)
    client.roomCode = room.roomCode
    send(client, { type: 'room-state', role: 'host', ...roomState(room) })
    return
  }

  if (type === 'join-room') {
    const roomCode = String(message.roomCode || '').trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) return send(client, { type: 'error', code: 'INVALID_ROOM_CODE', message: 'Enter a valid 6-character room code.' })
    const room = rooms.get(roomCode)
    if (!room) return send(client, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'That room is unavailable or has ended.' })
    removeClientFromRoom(client)
    room.participants.add(client.clientId)
    client.roomCode = roomCode
    send(client, { type: 'room-state', role: 'guest', ...roomState(room) })
    broadcastPresence(room)
    return
  }

  const room = client.roomCode ? rooms.get(client.roomCode) : null
  if (type === 'leave-room') { removeClientFromRoom(client); send(client, { type: 'presence-update', participantCount: 0 }); return }
  if (!room) return send(client, { type: 'error', code: 'NOT_IN_ROOM', message: 'Join a room before sending room updates.' })
  if (type === 'chat-message') {
    const chatText = String(message.text || '').trim().slice(0, 280)
    if (!chatText) return

    room.chatMessages = Array.isArray(room.chatMessages)
      ? room.chatMessages
      : []

    const chatMessage = {
      id: crypto.randomUUID(),
      clientId: client.clientId,
      text: chatText,
      sentAt: Date.now(),
    }

    room.chatMessages.push(chatMessage)
    room.chatMessages = room.chatMessages.slice(-50)

    // Chat is a real room-state revision too.
    room.updatedAt = Date.now()
    room.syncVersion += 1

    // Send the new message to everyone immediately.
    broadcast(room, {
      type: 'room-state',
      ...roomState(room),
    })

    return
  }

  if (type === 'playback-update') {
    room.activeVideoId = message.activeVideoId || ''
    room.activeVideoMetadata = message.activeVideoMetadata || null
    room.isPlaying = Boolean(message.isPlaying)
    room.playbackPosition = Math.max(0, Number(message.playbackPosition) || 0)
    room.updatedAt = Date.now()
    room.syncVersion += 1

    room.seekId =
      typeof message.seekId === 'string' && message.seekId.length <= 100
        ? message.seekId
        : null

    room.seekPosition =
      Number.isFinite(Number(message.seekPosition))
        ? Math.max(0, Number(message.seekPosition))
        : null

    broadcast(
      room,
      { type: 'room-state', ...roomState(room) },
      client.clientId
    )
  } else if (type === 'queue-update') {
    room.queue = Array.isArray(message.queue) ? message.queue : []

    /*
     * Queue changes are also authoritative room changes.
     * Give them a revision so clients cannot silently keep
     * an older queue after a newer playback command.
     */
    room.updatedAt = Date.now()
    room.syncVersion += 1

    broadcast(
      room,
      { type: 'room-state', ...roomState(room) },
      client.clientId
    )
  }
}

app.get('/api/youtube/search', async (request, response) => {
  const query = request.query.q?.trim()

  if (!process.env.YOUTUBE_API_KEY) {
    return response.status(500).json({ error: 'YouTube API key is not configured.' })
  }

  if (!query) {
    return response.status(400).json({ error: 'A search query is required.' })
  }

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '12',
    q: query,
    key: process.env.YOUTUBE_API_KEY,
  })

  try {
    const youtubeResponse = await fetch(`${youtubeSearchEndpoint}?${searchParams}`)
    const payload = await youtubeResponse.json()

    if (!youtubeResponse.ok) {
      return response.status(youtubeResponse.status >= 500 ? 502 : youtubeResponse.status).json({
        error: payload.error?.message || 'YouTube search failed.',
      })
    }

    const results = (payload.items || []).map((item) => ({
      id: { videoId: item.id?.videoId },
      snippet: {
        title: item.snippet?.title,
        channelTitle: item.snippet?.channelTitle || 'YouTube channel',
        thumbnails: item.snippet?.thumbnails || {},
      },
    })).filter((item) => item.id.videoId && item.snippet.title)

    return response.json({ results })
  } catch {
    return response.status(502).json({ error: 'Unable to reach YouTube.' })
  }
})

const server = http.createServer(app)
const websocketServer = new WebSocketServer({ server, path: '/ws' })

websocketServer.on('connection', (socket) => {
  const client = { socket, clientId: crypto.randomUUID(), roomCode: null }
  clients.set(client.clientId, client)
  socket.on('message', (rawMessage) => {
    try { handleRoomMessage(client, JSON.parse(rawMessage.toString())) } catch { send(client, { type: 'error', code: 'INVALID_MESSAGE', message: 'That room message was not valid.' }) }
  })
  socket.on('close', () => { removeClientFromRoom(client); clients.delete(client.clientId) })
  socket.on('error', () => { removeClientFromRoom(client); clients.delete(client.clientId) })
})

const PORT = Number(process.env.PORT) || 8787

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Krovi server listening on ${PORT}`)
})