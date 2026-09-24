const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const WebSocket = require('ws')

const port = 8899
const server = spawn(process.execPath, ['server.cjs'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
server.stdout.on('data', (chunk) => { output += chunk.toString() })
server.stderr.on('data', (chunk) => { output += chunk.toString() })

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHealth() {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/health')
      if (response.ok) return response.json()
    } catch {
      // Server is still starting.
    }
    await wait(100)
  }
  throw new Error('Server did not become healthy.\\n' + output)
}

function openClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws')
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function nextMessage(socket, predicate, timeout = 4_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for WebSocket message.'))
    }, timeout)

    const onMessage = (raw) => {
      try {
        const message = JSON.parse(raw.toString())
        if (!predicate(message)) return
        cleanup()
        resolve(message)
      } catch {
        // Ignore malformed messages here; the server smoke test only accepts valid JSON.
      }
    }

    const onClose = () => {
      cleanup()
      reject(new Error('WebSocket closed before the expected message.'))
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

function send(socket, message) {
  socket.send(JSON.stringify(message))
}

async function main() {
  const health = await waitForHealth()
  assert.equal(health.ok, true)
  assert.equal(health.service, 'krovi-music-api')

  const clientA = await openClient()
  const clientB = await openClient()
  const clientAId = 'smoke-a'
  const clientBId = 'smoke-b'

  try {
    send(clientA, {
      type: 'create-room',
      clientId: clientAId,
      playback: {
        currentTrack: {
          videoId: 'smoke-video',
          title: 'Smoke Test',
          artist: 'Krovi',
        },
        queue: [],
        isPlaying: true,
        currentTime: 12,
      },
    })

    const created = await nextMessage(clientA, (message) => message.type === 'room-state' && message.role === 'host')
    assert.match(created.roomCode, /^[A-Z0-9]{6}$/)
    assert.equal(created.isPlaying, true)

    send(clientB, {
      type: 'join-room',
      clientId: clientBId,
      roomCode: created.roomCode,
    })

    const joined = await nextMessage(clientB, (message) => message.type === 'room-state' && message.role === 'guest')
    assert.equal(joined.roomCode, created.roomCode)
    assert.equal(joined.participantCount, 2)

    send(clientA, {
      type: 'playback-update',
      clientId: clientAId,
      roomCode: created.roomCode,
      activeVideoId: 'smoke-video-2',
      activeVideoMetadata: {
        videoId: 'smoke-video-2',
        title: 'Second Smoke Test',
        artist: 'Krovi',
      },
      isPlaying: false,
      playbackPosition: 42,
      command: 'seek',
      seekId: 'smoke-seek',
      seekPosition: 42,
    })

    const playback = await nextMessage(clientB, (message) => message.type === 'playback-state')
    assert.equal(playback.activeVideoId, 'smoke-video-2')
    assert.equal(playback.isPlaying, false)
    assert.equal(playback.seekId, 'smoke-seek')
    assert.equal(playback.seekPosition, 42)

    send(clientB, {
      type: 'queue-update',
      clientId: clientBId,
      roomCode: created.roomCode,
      queue: [{
        videoId: 'queued-video',
        title: 'Queued Smoke Test',
        artist: 'Krovi',
      }],
    })

    const queue = await nextMessage(clientA, (message) => message.type === 'queue-state')
    assert.equal(queue.queue.length, 1)
    assert.equal(queue.queue[0].videoId, 'queued-video')

    send(clientA, {
      type: 'chat-message',
      clientId: clientAId,
      roomCode: created.roomCode,
      text: 'hello',
    })

    const chat = await nextMessage(clientB, (message) => message.type === 'chat-message')
    assert.equal(chat.message.text, 'hello')
    assert.equal(chat.message.clientId, clientAId)

    send(clientB, {
      type: 'leave-room',
      clientId: clientBId,
    })

    await nextMessage(clientB, (message) => message.type === 'left-room')

    console.log('Krovi server smoke test passed.')
  } finally {
    clientA?.close()
    clientB?.close()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => server.kill('SIGTERM'), 50)
  })
