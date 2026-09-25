import assert from 'node:assert/strict'
import WebSocket from 'ws'

const baseUrl = 'https://krovi-music.onrender.com'
const restClientId = 'production-smoke-rest-' + Date.now()
const wsClientId = 'production-smoke-ws-' + Date.now()

async function request(path, options) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  assert.equal(response.ok, true, JSON.stringify(payload))
  return payload
}

function waitForMessage(socket, predicate, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for production Connect message.'))
    }, timeout)

    const onMessage = (raw) => {
      try {
        const message = JSON.parse(raw.toString())
        if (!predicate(message)) return
        cleanup()
        resolve(message)
      } catch {
        // Ignore malformed data.
      }
    }

    const onClose = () => {
      cleanup()
      reject(new Error('Production Connect socket closed unexpectedly.'))
    }

    const cleanup = () => {
      clearTimeout(timer)
      socket.off('message', onMessage)
      socket.off('close', onClose)
    }

    socket.on('message', onMessage)
    socket.once('close', onClose)
  })
}

const health = await request('/health')
assert.equal(health.ok, true)

const restRoom = await request('/api/connect/rooms', {
  method: 'POST',
  body: JSON.stringify({
    clientId: restClientId,
    playback: {
      currentTrack: {
        videoId: 'production-smoke',
        title: 'Production Smoke',
        artist: 'Krovi',
      },
      queue: [],
      isPlaying: true,
      currentTime: 4,
    },
  }),
})

assert.match(restRoom.roomCode, /^[A-Z0-9]{6}$/)
assert.equal(restRoom.participantCount, 1)

const restState = await request(
  '/api/connect/rooms/' + restRoom.roomCode + '/state?clientId=' + encodeURIComponent(restClientId),
  { method: 'GET' },
)

assert.equal(restState.activeVideoId, 'production-smoke')

const socket = new WebSocket(baseUrl.replace('https://', 'wss://') + '/ws')

try {
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })

  socket.send(JSON.stringify({
    type: 'join-room',
    clientId: wsClientId,
    roomCode: restRoom.roomCode,
  }))

  const joined = await waitForMessage(socket, (message) => message.type === 'room-state')
  assert.equal(joined.roomCode, restRoom.roomCode)
  assert.equal(joined.participantCount, 2)
} finally {
  socket.close()
}

await request('/api/connect/rooms/' + restRoom.roomCode + '/leave', {
  method: 'POST',
  body: JSON.stringify({ clientId: restClientId }),
})

console.log('Production Connect transport smoke test passed.')
