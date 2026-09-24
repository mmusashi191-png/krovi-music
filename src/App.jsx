import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Library, Link2, Home as HomeIcon } from 'lucide-react'
import './App.css'
import Connect from './components/Connect.jsx'
import Explore from './components/Explore.jsx'
import Home from './components/Home.jsx'
import Player from './components/Player.jsx'
import Playlists, { PlaylistPicker } from './components/Playlists.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import { searchYouTube } from './services/youtubeApi.js'
import {
  connectConfigMessage,
  createRoom,
  joinRoom,
  leaveRoom,
  sendChatMessage,
  subscribeToConnection,
  subscribeToRoom,
  updatePlaybackState,
  updateQueue,
} from './services/connectRoom.js'

const STORAGE = {
  liked: 'krovi-liked-v3',
  recent: 'krovi-recent-v3',
  playlists: 'krovi-playlists-v3',
  playback: 'krovi-playback-v3',
  searches: 'krovi-searches-v3',
  theme: 'krovi-theme-v3',
}

const THEMES = ['rose', 'verdant']

function readStorage(key, fallback, legacyKeys = []) {
  try {
    for (const storageKey of [key, ...legacyKeys]) {
      const raw = window.localStorage.getItem(storageKey)
      if (raw == null) continue
      return JSON.parse(raw)
    }
  } catch {
    return fallback
  }
  return fallback
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local persistence is optional.
  }
}

function isTrack(track) {
  return Boolean(track?.videoId && track?.title)
}

function normalizeTrack(track) {
  return {
    videoId: String(track.videoId),
    title: String(track.title),
    artist: String(track.artist || 'YouTube'),
    thumbnail: typeof track.thumbnail === 'string' ? track.thumbnail : '',
    duration: typeof track.duration === 'string' ? track.duration : '',
  }
}

function cleanTracks(value) {
  return Array.isArray(value) ? value.filter(isTrack).map(normalizeTrack) : []
}

function uniqueTracks(tracks) {
  return [...new Map(cleanTracks(tracks).map((track) => [track.videoId, track])).values()]
}

function initialPlayback() {
  const stored = readStorage(STORAGE.playback, {}, ['krovi-playback-v1'])
  const currentTrack = isTrack(stored.currentTrack) ? normalizeTrack(stored.currentTrack) : null
  const legacyQueue = readStorage('krovi-queue', [])
  const storedQueue = uniqueTracks([...cleanTracks(stored.queue), ...cleanTracks(legacyQueue)])
  const queue = currentTrack && !storedQueue.some((track) => track.videoId === currentTrack.videoId)
    ? [currentTrack, ...storedQueue]
    : storedQueue

  return {
    currentTrack,
    queue,
    currentQueueIndex: currentTrack
      ? Math.max(0, queue.findIndex((track) => track.videoId === currentTrack.videoId))
      : -1,
    isPlaying: false,
    currentTime: Number.isFinite(stored.currentTime) ? Math.max(0, stored.currentTime) : 0,
    duration: 0,
    pipVisible: Boolean(currentTrack),
    pipPosition: stored.pipPosition || null,
    isLoading: false,
    error: '',
    seekRequest: null,
  }
}

function App() {
  const [view, setView] = useState('home')
  const [theme, setTheme] = useState(() => {
    const stored = readStorage(STORAGE.theme, 'rose')
    return THEMES.includes(stored) ? stored : 'rose'
  })
  const [playback, setPlayback] = useState(initialPlayback)
  const [likedTracks, setLikedTracks] = useState(() => cleanTracks(readStorage(STORAGE.liked, [], ['krovi-library-v1', 'krovi-liked-songs'])))
  const [recentTracks, setRecentTracks] = useState(() => cleanTracks(readStorage(STORAGE.recent, [], ['krovi-recently-played'])))
  const [playlists, setPlaylists] = useState(() => {
    const stored = readStorage(STORAGE.playlists, [], ['krovi-playlists-v1'])
    return Array.isArray(stored)
      ? stored
        .map((playlist) => {
          const tracks = cleanTracks(Array.isArray(playlist?.songs) ? playlist.songs : playlist?.tracks)
          return {
            ...playlist,
            id: String(playlist?.id || ''),
            name: String(playlist?.name || '').trim().slice(0, 60),
            description: String(playlist?.description || ''),
            coverImage: String(playlist?.coverImage || ''),
            songs: tracks,
            tracks,
          }
        })
        .filter((playlist) => playlist.id && playlist.name)
      : []
  })
  const [searches, setSearches] = useState(() => {
    const stored = readStorage(STORAGE.searches, [], ['krovi-recent-searches'])
    return Array.isArray(stored)
      ? stored.filter((item) => typeof item === 'string' && item.trim()).slice(0, 8)
      : []
  })
  const [search, setSearch] = useState({
    query: '',
    submittedQuery: '',
    results: [],
    loading: false,
    error: '',
  })
  const [playlistPickerTrack, setPlaylistPickerTrack] = useState(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectRoom, setConnectRoom] = useState(null)
  const [connectStatus, setConnectStatus] = useState('idle')
  const [connectError, setConnectError] = useState('')
  const [chatMessages, setChatMessages] = useState([])

  const roomCode = connectRoom?.roomCode || ''

  const playbackRef = useRef(playback)
  const roomVersionRef = useRef(0)
  const seekIdRef = useRef('')

  useEffect(() => {
    playbackRef.current = playback
  }, [playback])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorage(STORAGE.theme, theme)
  }, [theme])

  useEffect(() => writeStorage(STORAGE.liked, likedTracks), [likedTracks])
  useEffect(() => writeStorage(STORAGE.recent, recentTracks.slice(0, 20)), [recentTracks])
  useEffect(() => writeStorage(STORAGE.playlists, playlists), [playlists])
  useEffect(() => writeStorage(STORAGE.searches, searches.slice(0, 8)), [searches])
  useEffect(() => {
    writeStorage(STORAGE.playback, {
      currentTrack: playback.currentTrack,
      queue: playback.queue,
      currentTime: playback.currentTime,
      pipPosition: playback.pipPosition,
    })
  }, [playback])

  useEffect(() => subscribeToConnection((message) => {
    if (message.state) setConnectStatus(message.state)
  }), [])

  useEffect(() => {
    if (!connectRoom?.roomCode) return undefined

    roomVersionRef.current = 0
    seekIdRef.current = ''
    return subscribeToRoom(roomCode, (message) => {
      if (message.type === 'error') {
        setConnectError(message.message || connectConfigMessage)
        if (message.code === 'ROOM_NOT_FOUND') {
          setConnectRoom(null)
          setChatMessages([])
        }
        return
      }

      if (message.type === 'presence-state') {
        setConnectRoom((room) => room
          ? { ...room, participantCount: Math.max(1, Number(message.participantCount) || 1) }
          : room)
        return
      }

      if (message.type === 'chat-message') {
        setChatMessages((current) => [...current, message.message].slice(-50))
        return
      }

      if (message.type === 'queue-state') {
        const version = Number(message.version) || 0
        if (version && version <= roomVersionRef.current) return
        if (version) roomVersionRef.current = version
        setPlayback((current) => {
          const queue = cleanTracks(message.queue)
          return {
            ...current,
            queue,
            currentQueueIndex: current.currentTrack
              ? Math.max(0, queue.findIndex((track) => track.videoId === current.currentTrack.videoId))
              : -1,
          }
        })
        return
      }

      if (message.type !== 'room-state' && message.type !== 'playback-state') return

      const version = Number(message.version) || 0
      if (version && version <= roomVersionRef.current) return
      if (version) roomVersionRef.current = version

      if (message.type === 'room-state' && Array.isArray(message.chatMessages)) {
        setChatMessages(message.chatMessages.slice(-50))
      }

      const nextTrack = isTrack(message.activeVideoMetadata)
        ? normalizeTrack(message.activeVideoMetadata)
        : null
      const remoteQueue = message.type === 'room-state'
        ? cleanTracks(message.queue)
        : playbackRef.current.queue
      const remotePlaying = Boolean(message.isPlaying)
      const position = Math.max(0, Number(message.playbackPosition) || 0)
      const updatedAt = Number(message.updatedAt) || Date.now()
      const currentTime = remotePlaying
        ? position + Math.max(0, (Date.now() - updatedAt) / 1000)
        : position
      const remoteSeekId = typeof message.seekId === 'string' ? message.seekId : ''
      const shouldSeek = Boolean(remoteSeekId && remoteSeekId !== seekIdRef.current && nextTrack)
      if (remoteSeekId) seekIdRef.current = remoteSeekId
      const sameTrack = playbackRef.current.currentTrack?.videoId === nextTrack?.videoId

      setPlayback((current) => ({
        ...current,
        currentTrack: nextTrack,
        queue: remoteQueue,
        currentQueueIndex: nextTrack
          ? Math.max(0, remoteQueue.findIndex((track) => track.videoId === nextTrack.videoId))
          : -1,
        isPlaying: remotePlaying,
        currentTime,
        duration: sameTrack ? current.duration : 0,
        pipVisible: Boolean(nextTrack),
        isLoading: false,
        error: '',
        seekRequest: shouldSeek && ['track', 'seek'].includes(message.command)
          ? {
              videoId: nextTrack.videoId,
              time: Number.isFinite(Number(message.seekPosition))
                ? Math.max(0, Number(message.seekPosition))
                : currentTime,
              token: remoteSeekId,
              remote: true,
            }
          : null,
      }))
    })
  }, [roomCode])

  const commitPlayback = useCallback((changes, options = {}) => {
    const next = {
      ...playbackRef.current,
      ...changes,
      seekRequest: changes.seekRequest || null,
    }

    playbackRef.current = next
    setPlayback(next)

    if (options.sync && roomCode) {
      updatePlaybackState(roomCode, next, {
        command: options.command || 'playback',
        seekPosition: options.seekPosition,
      }).catch(() => setConnectError('Connect lost its network connection.'))
    }
  }, [roomCode])

  const commitQueue = useCallback((queue) => {
    const cleaned = cleanTracks(queue)
    const current = playbackRef.current
    const next = {
      ...current,
      queue: cleaned,
      currentQueueIndex: current.currentTrack
        ? Math.max(0, cleaned.findIndex((track) => track.videoId === current.currentTrack.videoId))
        : -1,
    }

    playbackRef.current = next
    setPlayback(next)

    if (roomCode) {
      updateQueue(roomCode, cleaned)
        .catch(() => setConnectError('Queue could not be shared with the room.'))
    }
  }, [roomCode])

  const selectTrack = useCallback((track, shouldPlay = false, nextQueue = null) => {
    if (!isTrack(track)) return
    const selected = normalizeTrack(track)
    const sourceQueue = nextQueue ? cleanTracks(nextQueue) : playbackRef.current.queue
    const queue = sourceQueue.some((item) => item.videoId === selected.videoId)
      ? sourceQueue
      : [selected, ...sourceQueue]

    commitPlayback({
      currentTrack: selected,
      queue,
      currentQueueIndex: queue.findIndex((item) => item.videoId === selected.videoId),
      currentTime: 0,
      duration: 0,
      isPlaying: shouldPlay,
      isLoading: shouldPlay,
      pipVisible: true,
      error: '',
      seekRequest: null,
    }, {
      sync: Boolean(roomCode),
      command: 'track',
      seekPosition: 0,
    })
  }, [commitPlayback, roomCode])

  const rememberPlayed = useCallback((track) => {
    if (!isTrack(track)) return
    const normalized = normalizeTrack(track)
    setRecentTracks((current) => [
      normalized,
      ...current.filter((item) => item.videoId !== normalized.videoId),
    ].slice(0, 20))
  }, [])

  const toggleLike = useCallback((track) => {
    if (!isTrack(track)) return
    const normalized = normalizeTrack(track)
    setLikedTracks((current) => current.some((item) => item.videoId === normalized.videoId)
      ? current.filter((item) => item.videoId !== normalized.videoId)
      : [normalized, ...current])
  }, [])

  const addToQueue = useCallback((track) => {
    if (!isTrack(track)) return
    const queue = playbackRef.current.queue
    if (queue.some((item) => item.videoId === track.videoId)) return
    commitQueue([...queue, normalizeTrack(track)])
  }, [commitQueue])

  const playNext = useCallback((track) => {
    if (!isTrack(track)) return
    const current = playbackRef.current
    if (current.queue.some((item) => item.videoId === track.videoId)) return
    const index = current.currentTrack
      ? Math.max(0, current.currentQueueIndex + 1)
      : current.queue.length
    const queue = [...current.queue]
    queue.splice(index, 0, normalizeTrack(track))
    commitQueue(queue)
  }, [commitQueue])

  const removeFromQueue = useCallback((videoId) => {
    commitQueue(playbackRef.current.queue.filter((track) => track.videoId !== videoId))
  }, [commitQueue])

  const clearQueue = useCallback(() => {
    const current = playbackRef.current
    commitQueue(current.currentTrack ? [current.currentTrack] : [])
  }, [commitQueue])

  const playAll = useCallback((tracks, shuffle = false) => {
    const source = cleanTracks(tracks)
    if (!source.length) return
    const queue = shuffle
      ? [...source].sort(() => Math.random() - 0.5)
      : source
    selectTrack(queue[0], true, queue)
    setView('home')
  }, [selectTrack])

  const submitSearch = useCallback((value) => {
    const query = String(value || '').trim()
    if (query.length < 2) return
    setSearch((current) => ({
      ...current,
      query,
      submittedQuery: query,
      results: [],
      loading: true,
      error: '',
    }))
    setSearches((current) => [
      query,
      ...current.filter((item) => item.toLowerCase() !== query.toLowerCase()),
    ].slice(0, 8))
    setView('explore')
  }, [])

  useEffect(() => {
    if (!search.submittedQuery) return undefined

    const controller = new AbortController()
    const query = search.submittedQuery
    searchYouTube(query, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return
        setSearch((current) => current.submittedQuery === query
          ? { ...current, results, loading: false }
          : current)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setSearch((current) => current.submittedQuery === query
          ? {
              ...current,
              results: [],
              loading: false,
              error: error.message || 'Search is unavailable.',
            }
          : current)
      })

    return () => controller.abort()
  }, [search.submittedQuery])

  const clearSearch = useCallback(() => {
    setSearch((current) => ({
      ...current,
      query: '',
      submittedQuery: '',
      results: [],
      loading: false,
      error: '',
    }))
  }, [])

  const createPlaylist = useCallback((details) => {
    const timestamp = Date.now()
    const playlist = {
      id: 'playlist-' + timestamp + '-' + Math.random().toString(36).slice(2, 7),
      name: String(details.name || '').trim().slice(0, 60),
      description: String(details.description || '').trim(),
      coverImage: String(details.coverImage || '').trim(),
      songs: [],
      tracks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setPlaylists((current) => [...current, playlist])
    return playlist
  }, [])

  const updatePlaylist = useCallback((id, details) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== id) return playlist
      const tracks = cleanTracks(details.songs || details.tracks || playlist.songs)
      return {
        ...playlist,
        ...details,
        name: String(details.name || playlist.name).trim().slice(0, 60),
        songs: tracks,
        tracks,
        updatedAt: Date.now(),
      }
    }))
  }, [])

  const deletePlaylist = useCallback((id) => {
    setPlaylists((current) => current.filter((playlist) => playlist.id !== id))
  }, [])

  const addToPlaylist = useCallback((playlistId, track) => {
    if (!isTrack(track)) return false
    const normalized = normalizeTrack(track)
    const playlist = playlists.find((item) => item.id === playlistId)
    if (!playlist || playlist.songs.some((item) => item.videoId === normalized.videoId)) return false
    const songs = [...playlist.songs, normalized]
    setPlaylists((current) => current.map((item) => item.id === playlistId
      ? { ...item, songs, tracks: songs, updatedAt: Date.now() }
      : item))
    return true
  }, [playlists])

  const removeFromPlaylist = useCallback((playlistId, videoId) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist
      const tracks = playlist.songs.filter((track) => track.videoId !== videoId)
      return { ...playlist, songs: tracks, tracks, updatedAt: Date.now() }
    }))
  }, [])

  const openConnect = useCallback(() => {
    setConnectError('')
    setConnectOpen(true)
  }, [])

  const closeConnect = useCallback(() => {
    setConnectOpen(false)
  }, [])

  const closePlaylistPicker = useCallback(() => {
    setPlaylistPickerTrack(null)
  }, [])

  const handleCreateRoom = useCallback(async () => {
    setConnectError('')
    try {
      const room = await createRoom(playbackRef.current)
      setConnectRoom(room)
      setChatMessages([])
      setConnectOpen(true)
    } catch (error) {
      setConnectError(error.message || connectConfigMessage)
    }
  }, [])

  const handleJoinRoom = useCallback(async (roomCode) => {
    setConnectError('')
    try {
      const room = await joinRoom(roomCode)
      setConnectRoom(room)
      setChatMessages([])
      setConnectOpen(true)
    } catch (error) {
      setConnectError(error.message || connectConfigMessage)
    }
  }, [])

  const handleLeaveRoom = useCallback(() => {
    leaveRoom()
    setConnectRoom(null)
    setChatMessages([])
    setConnectStatus('idle')
    setConnectError('')
  }, [])

  const handleSendChat = useCallback(async (message) => {
    if (!roomCode) return
    try {
      await sendChatMessage(roomCode, message)
    } catch {
      setConnectError('Message could not be sent.')
    }
  }, [roomCode])

  const availableLibraryTracks = useMemo(() => uniqueTracks([
    ...likedTracks,
    ...recentTracks,
    ...playback.queue,
  ]), [likedTracks, recentTracks, playback.queue])

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <button type="button" className="brand-button" onClick={() => setView('home')} aria-label="Krovi home">
          <span className="brand-mark">k</span>
          <span className="brand-name">Krovi</span>
        </button>

        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === 'rose' ? 'verdant' : 'rose')} />
          <button type="button" className="connect-button" onClick={openConnect}>
            <Link2 size={17} />
            <span>Connect</span>
            {connectRoom?.participantCount > 1 && <i aria-label="Two listeners connected" />}
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'home' && (
          <Home
            recentTracks={recentTracks}
            likedTracks={likedTracks}
            playlists={playlists}
            onSubmitSearch={submitSearch}
            onOpenExplore={() => setView('explore')}
            onPlay={(track) => selectTrack(track, true)}
            onPlayAll={playAll}
          />
        )}

        {view === 'explore' && (
          <Explore
            query={search.query}
            submittedQuery={search.submittedQuery}
            results={search.results}
            isLoading={search.loading}
            error={search.error}
            recentSearches={searches}
            onQueryChange={(query) => setSearch((current) => ({ ...current, query }))}
            onSubmitSearch={submitSearch}
            onClearSearch={clearSearch}
            onClearRecentSearches={() => setSearches([])}
            onSelectResult={(track) => selectTrack(track, true, search.results)}
            onAddToQueue={addToQueue}
            onPlayNext={playNext}
            likedTracks={likedTracks}
            onToggleLike={toggleLike}
            onRequestPlaylist={setPlaylistPickerTrack}
            onBack={() => setView('home')}
          />
        )}

        {view === 'library' && (
          <Playlists
            playlists={playlists}
            savedTracks={likedTracks}
            recentTracks={recentTracks}
            availableTracks={availableLibraryTracks}
            onCreate={createPlaylist}
            onUpdate={updatePlaylist}
            onDelete={deletePlaylist}
            onPlayTrack={(track, queue) => selectTrack(track, true, queue)}
            onPlayAll={playAll}
            onAddTrack={addToPlaylist}
            onRemoveTrack={removeFromPlaylist}
            onAddToQueue={addToQueue}
            onPlayNext={playNext}
            onToggleLike={toggleLike}
            onRemoveRecent={(videoId) => setRecentTracks((current) => current.filter((track) => track.videoId !== videoId))}
            onRequestPlaylist={setPlaylistPickerTrack}
            onExplore={() => setView('explore')}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {[
          ['home', 'Home', HomeIcon],
          ['explore', 'Explore', Compass],
          ['library', 'Library', Library],
        ].map(([key, label, Icon]) => (
          <button type="button" key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className={connectOpen ? 'active' : ''} onClick={openConnect}>
          <Link2 size={19} />
          <span>Connect</span>
        </button>
      </nav>

      <Player
        playback={playback}
        onPlaybackChange={commitPlayback}
        onSelectTrack={selectTrack}
        onTrackStarted={rememberPlayed}
        likedTracks={likedTracks}
        onToggleLike={toggleLike}
        onRequestPlaylist={setPlaylistPickerTrack}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
      />

      {playlistPickerTrack && (
        <PlaylistPicker
          track={playlistPickerTrack}
          playlists={playlists}
          onAdd={addToPlaylist}
          onCreate={createPlaylist}
          onClose={closePlaylistPicker}
        />
      )}

      {connectOpen && (
        <Connect
          room={connectRoom}
          status={connectStatus}
          error={connectError}
          chatMessages={chatMessages}
          onCreate={handleCreateRoom}
          onJoin={handleJoinRoom}
          onLeave={handleLeaveRoom}
          onSendChat={handleSendChat}
          onClose={closeConnect}
        />
      )}
    </div>
  )
}

export default App
