import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Compass, Home, Library, UserRound } from 'lucide-react'
import './App.css'
import Connect from './components/Connect.jsx'
import Player from './components/Player.jsx'
import PersonalizedHome from './components/Home.jsx'
import Explore from './components/Explore.jsx'
import Playlists, { PlaylistPicker } from './components/Playlists.jsx'
import { searchMood, searchYouTube } from './services/youtubeApi.js'
import { connectConfigMessage, createRoom, isConnectConfigured, joinRoom, leaveRoom, subscribeToPresence, subscribeToRoom, updatePlaybackState } from './services/connectRoom.js'

const RECENT_STORAGE_KEY = 'krovi-recently-played'
const LIKED_STORAGE_KEY = 'krovi-library-v1'
const LEGACY_LIKED_STORAGE_KEY = 'krovi-liked-songs'
const QUEUE_STORAGE_KEY = 'krovi-queue'
const PLAYBACK_STORAGE_KEY = 'krovi-playback-v1'
const PLAYLISTS_STORAGE_KEY = 'krovi-playlists-v1'
const SEARCHES_STORAGE_KEY = 'krovi-recent-searches'
const ACTIVE_VIEW_STORAGE_KEY = 'krovi-active-view-v1'

function readStoredTracks(key) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(stored) ? stored.filter(isPlayableTrack).map(normalizeTrack) : []
  } catch {
    window.localStorage.removeItem(key)
    return []
  }
}

function readStoredPlaylists() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYLISTS_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((playlist) => playlist?.id && typeof playlist.name === 'string').map((playlist) => {
      const tracks = (Array.isArray(playlist.songs) ? playlist.songs : Array.isArray(playlist.tracks) ? playlist.tracks : []).filter(isPlayableTrack).map(normalizeTrack)
      return { ...playlist, name: playlist.name.trim().slice(0, 60), songs: tracks, tracks }
    }).filter((playlist) => playlist.name) : []
  } catch { window.localStorage.removeItem(PLAYLISTS_STORAGE_KEY); return [] }
}

function readStoredSearches() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SEARCHES_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((search) => typeof search === 'string' && search.trim()).slice(0, 8) : []
  } catch { window.localStorage.removeItem(SEARCHES_STORAGE_KEY); return [] }
}

function readStoredActiveView() {
  try {
    const view = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)
    return ['home', 'explore', 'library'].includes(view) ? view : 'home'
  } catch {
    window.localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY)
    return 'home'
  }
}

function readStoredPlayback() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYBACK_STORAGE_KEY) || '{}')
    let queue = (Array.isArray(stored.queue) ? stored.queue : readStoredTracks(QUEUE_STORAGE_KEY)).filter(isPlayableTrack).map(normalizeTrack)
    const currentTrack = isPlayableTrack(stored.currentTrack) ? normalizeTrack(stored.currentTrack) : null
    if (currentTrack && !queue.some((track) => track.videoId === currentTrack.videoId)) queue = [currentTrack, ...queue]
    const currentQueueIndex = currentTrack ? Math.max(0, queue.findIndex((track) => track.videoId === currentTrack.videoId)) : -1
    return {
      currentTrack,
      isPlaying: false,
      currentTime: Number.isFinite(stored.currentTime) ? Math.max(0, stored.currentTime) : 0,
      duration: 0,
      queue,
      currentQueueIndex: currentQueueIndex >= 0 ? currentQueueIndex : (currentTrack ? 0 : -1),
      playerVisible: Boolean(currentTrack),
      pipVisible: stored.pipVisible !== false,
      pipPosition: stored.pipPosition || null,
      isLoading: false,
      error: '',
    }
  } catch {
    window.localStorage.removeItem(PLAYBACK_STORAGE_KEY)
    return { currentTrack: null, isPlaying: false, currentTime: 0, duration: 0, queue: [], currentQueueIndex: -1, playerVisible: false, pipVisible: true, pipPosition: null, isLoading: false, error: '' }
  }
}

function isPlayableTrack(track) {
  return Boolean(track?.videoId && track.title && track.artist)
}

function normalizeTrack(track) {
  return { ...track, videoId: String(track.videoId), title: String(track.title), artist: String(track.artist || 'YouTube channel'), thumbnail: typeof track.thumbnail === 'string' ? track.thumbnail : '', duration: typeof track.duration === 'string' ? track.duration : '' }
}

function App() {
  const [activeView, setActiveView] = useState(readStoredActiveView)
  const [playback, setPlayback] = useState(readStoredPlayback)
  const [playRequest, setPlayRequest] = useState(null)
  const [recentTracks, setRecentTracks] = useState(() => readStoredTracks(RECENT_STORAGE_KEY).slice(0, 20))
  const [likedTracks, setLikedTracks] = useState(() => {
    const savedTracks = readStoredTracks(LIKED_STORAGE_KEY)
    return savedTracks.length ? savedTracks : readStoredTracks(LEGACY_LIKED_STORAGE_KEY)
  })
  const [playlists, setPlaylists] = useState(readStoredPlaylists)
  const [playlistPickerTrack, setPlaylistPickerTrack] = useState(null)
  const [searchState, setSearchState] = useState({ query: '', submittedQuery: '', results: [], isLoading: false, error: '', requestId: 0, mood: '' })
  const [recentSearches, setRecentSearches] = useState(readStoredSearches)
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [connectRoom, setConnectRoom] = useState(null)
  const [connectError, setConnectError] = useState('')
  const connectRemoteSignatureRef = useRef(null)
  const connectRevisionRef = useRef(0)
  const connectSyncRequestedRef = useRef(false)
  const playbackRef = useRef(playback)
  const { currentTrack, queue, currentQueueIndex } = playback
  useEffect(() => { playbackRef.current = playback }, [playback])

  useEffect(() => { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentTracks.slice(0, 20))) }, [recentTracks])
  useEffect(() => { window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedTracks)) }, [likedTracks])
  useEffect(() => {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.filter(isPlayableTrack)))
    window.localStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify({ ...playback, isPlaying: false, duration: 0, isLoading: false, error: '' }))
  }, [playback, queue])
  useEffect(() => { window.localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists)) }, [playlists])
  useEffect(() => { window.localStorage.setItem(SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches.slice(0, 8))) }, [recentSearches])
  useEffect(() => { window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView) }, [activeView])

  useEffect(() => {
  if (!connectRoom?.roomCode) return undefined

  let active = true
  let unsubscribeRoom
  let unsubscribePresence

  connectRevisionRef.current = 0

  try {
    unsubscribeRoom = subscribeToRoom(connectRoom.roomCode, (roomData) => {
      if (roomData?.type === 'error') {
        setConnectError(roomData.message || connectConfigMessage)
        return
      }

      if (!active || !roomData) return

      const syncVersion = Number(roomData.syncVersion) || 0

      if (syncVersion && syncVersion <= connectRevisionRef.current) {
        return
      }

      if (syncVersion) {
        connectRevisionRef.current = syncVersion
      }

      const nextTrack = isPlayableTrack(roomData.activeVideoMetadata)
        ? normalizeTrack(roomData.activeVideoMetadata)
        : null

      const remoteIsPlaying = Boolean(roomData.isPlaying)

      const playbackPosition = Number(roomData.playbackPosition)
      const seekPosition = Number(roomData.seekPosition)

      const basePosition =
        Number.isFinite(seekPosition) && seekPosition >= 0
          ? seekPosition
          : Number.isFinite(playbackPosition)
            ? Math.max(0, playbackPosition)
            : 0

      const updatedAt = Number(roomData.updatedAt) || Date.now()

      const remoteCurrentTime = remoteIsPlaying
        ? basePosition + Math.max(0, (Date.now() - updatedAt) / 1000)
        : basePosition

      const remoteQueue = Array.isArray(roomData.queue)
        ? roomData.queue
            .filter(isPlayableTrack)
            .map(normalizeTrack)
        : []

      /*
       * Every server state update represents a new authoritative
       * playback position. The receiving player should apply that
       * position exactly once.
       */
      const remoteSyncToken = `room-${syncVersion || updatedAt}`

      connectRemoteSignatureRef.current = JSON.stringify({
        track: nextTrack?.videoId || null,
        isPlaying: remoteIsPlaying,
        queue: remoteQueue.map((track) => track.videoId),
        syncToken: remoteSyncToken,
      })

      setPlayback((current) => {
        const sameTrack =
          current.currentTrack?.videoId === nextTrack?.videoId

        return {
          ...current,
          currentTrack: nextTrack,
          queue: remoteQueue,
          currentQueueIndex: nextTrack
            ? Math.max(
                0,
                remoteQueue.findIndex(
                  (track) => track.videoId === nextTrack.videoId
                )
              )
            : -1,
          isPlaying: remoteIsPlaying,
          currentTime: remoteCurrentTime,
          seekRequest: nextTrack
            ? {
                videoId: nextTrack.videoId,
                time: remoteCurrentTime,
                token: remoteSyncToken,
                remote: true,
              }
            : null,
          duration: sameTrack ? current.duration : 0,
          playerVisible: Boolean(nextTrack),
          isLoading: false,
          error: '',
        }
      })

      if (nextTrack) {
        const currentVideoId =
          playbackRef.current.currentTrack?.videoId || ''

        if (nextTrack.videoId !== currentVideoId) {
          setPlayRequest({
            videoId: nextTrack.videoId,
            token: Date.now(),
            autoplay: remoteIsPlaying,
          })
        } else {
          /*
           * Same song: the player already exists.
           * isPlaying + seekRequest will control it.
           */
          setPlayRequest(null)
        }
      } else {
        setPlayRequest(null)
      }
    })

    unsubscribePresence = subscribeToPresence(
      connectRoom.roomCode,
      (presence) => {
        if (active) {
          setConnectRoom((current) =>
            current ? { ...current, ...presence } : current
          )
        }
      }
    )
  } catch (error) {
    window.setTimeout(() => {
      if (!active) return

      setConnectError(
        error.code === 'CONNECT_NOT_CONFIGURED'
          ? connectConfigMessage
          : 'Connect could not start.'
      )
    }, 0)
  }

  return () => {
    active = false
    unsubscribeRoom?.()
    unsubscribePresence?.()
  }
}, [connectRoom?.roomCode])

  useEffect(() => {
  if (!connectRoom?.roomCode) return undefined
  if (!connectSyncRequestedRef.current) return undefined

  connectSyncRequestedRef.current = false

  const timer = window.setTimeout(() => {
    const outgoingPlayback = playbackRef.current

    updatePlaybackState(connectRoom.roomCode, outgoingPlayback)
      .catch(() => {
        setConnectError('Connect lost its network connection.')
      })
  }, 80)

  return () => window.clearTimeout(timer)
}, [
  connectRoom?.roomCode,
  playback.currentTrack?.videoId,
  playback.isPlaying,
  playback.seekRequest?.token,
  ])

  useEffect(() => {
    if (!searchState.submittedQuery && !searchState.mood) return undefined
    const controller = new AbortController()
    const request = searchState.mood ? searchMood(searchState.mood, controller.signal) : searchYouTube(searchState.submittedQuery, controller.signal)
    request
      .then((results) => setSearchState((current) => current.submittedQuery === searchState.submittedQuery && current.mood === searchState.mood ? { ...current, results, isLoading: false, error: '' } : current))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setSearchState((current) => current.submittedQuery === searchState.submittedQuery && current.mood === searchState.mood ? { ...current, isLoading: false, error: requestError.code === 'YOUTUBE_NOT_CONFIGURED' ? requestError.message : 'We could not reach YouTube right now.' } : current)
      })
    return () => controller.abort()
  }, [searchState.submittedQuery, searchState.requestId, searchState.mood])

  const selectTrack = (track, shouldPlay = false, nextQueue = null) => {
    if (!isPlayableTrack(track)) return
    const selectedTrack = normalizeTrack(track)
    setPlayback((current) => {
      const sourceQueue = nextQueue || current.queue
      const trackQueue = sourceQueue.some((candidate) => candidate.videoId === selectedTrack.videoId) ? sourceQueue : [...sourceQueue, selectedTrack]
      const trackIndex = trackQueue.findIndex((candidate) => candidate.videoId === selectedTrack.videoId)
      return { ...current, currentTrack: selectedTrack, queue: trackQueue, currentQueueIndex: trackIndex, currentTime: 0, duration: 0, isPlaying: false, playerVisible: true, pipVisible: current.pipVisible, isLoading: shouldPlay, error: '' }
    })
    setPlayRequest(shouldPlay ? { videoId: selectedTrack.videoId, token: Date.now() } : null)
  }

  const selectYouTubeResult = (result, shouldPlay = false, resultQueue = null) => {
    selectTrack(result, shouldPlay, resultQueue)
    setActiveView('home')
  }

  const addToQueue = (track) => {
    if (!isPlayableTrack(track)) return
    const queuedTrack = normalizeTrack(track)
    setPlayback((current) => current.queue.some((candidate) => candidate.videoId === queuedTrack.videoId) ? current : { ...current, queue: [...current.queue, queuedTrack], currentQueueIndex: current.currentTrack ? current.currentQueueIndex : 0 })
  }

  const playNext = (track) => {
    if (!isPlayableTrack(track)) return
    const queuedTrack = normalizeTrack(track)
    setPlayback((current) => {
      if (current.queue.some((candidate) => candidate.videoId === queuedTrack.videoId)) return current
      const insertAt = current.currentTrack ? Math.max(0, current.currentQueueIndex + 1) : current.queue.length
      return { ...current, queue: [...current.queue.slice(0, insertAt), queuedTrack, ...current.queue.slice(insertAt)] }
    })
  }

  const removeFromQueue = (videoId) => {
    const removedIndex = queue.findIndex((track) => track.videoId === videoId)
    if (removedIndex < 0) return
    setPlayback((current) => {
      const nextQueue = current.queue.filter((track) => track.videoId !== videoId)
      const nextIndex = removedIndex < current.currentQueueIndex ? current.currentQueueIndex - 1 : current.currentQueueIndex
      return { ...current, queue: nextQueue, currentQueueIndex: current.currentTrack?.videoId === videoId ? Math.min(nextIndex, nextQueue.length - 1) : nextIndex }
    })
  }

  const clearQueue = () => {
    setPlayback((current) => ({ ...current, queue: current.currentTrack ? [current.currentTrack] : [], currentQueueIndex: current.currentTrack ? 0 : -1 }))
  }



  const updatePlayback = (changes, options = {}) => {
    if (options.sync !== false) {
      connectSyncRequestedRef.current = true
    }

    setPlayback((current) => ({
      ...current,
      ...changes,
    }))
  }

  const toggleLike = (track) => {
    if (!isPlayableTrack(track)) return
    const savedTrack = { ...normalizeTrack(track), savedAt: new Date().toISOString() }
    setLikedTracks((currentLiked) => currentLiked.some((likedTrack) => likedTrack.videoId === track.videoId)
      ? currentLiked.filter((likedTrack) => likedTrack.videoId !== track.videoId)
      : [...currentLiked, savedTrack])
  }

  const handleTrackStarted = (track) => {
    if (!isPlayableTrack(track)) return
    const recentTrack = { videoId: track.videoId, title: track.title, artist: track.artist, thumbnail: track.thumbnail || '', duration: track.duration || '', lastPlayedAt: new Date().toISOString() }
    setRecentTracks((currentRecent) => [recentTrack, ...currentRecent.filter((item) => item.videoId !== track.videoId)].slice(0, 20))
  }

  const removeRecentTrack = (videoId) => setRecentTracks((currentRecent) => currentRecent.filter((track) => track.videoId !== videoId))

  const createPlaylist = (details) => {
    const now = Date.now()
    const playlist = { id: `playlist-${now}-${Math.random().toString(36).slice(2, 8)}`, name: details.name.trim().slice(0, 60), description: details.description?.trim() || '', songs: [], tracks: [], createdAt: now, updatedAt: now }
    setPlaylists((current) => [...current, playlist])
    return playlist
  }
  const updatePlaylist = (id, details) => setPlaylists((current) => current.map((playlist) => playlist.id === id ? { ...playlist, ...details, updatedAt: Date.now() } : playlist))
  const deletePlaylist = (id) => { if (window.confirm('Delete this playlist? Your liked and recent songs will stay safe.')) setPlaylists((current) => current.filter((playlist) => playlist.id !== id)) }
  const addToPlaylist = (playlistId, track) => {
    if (!isPlayableTrack(track)) return false
    let added = false
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId || playlist.songs.some((item) => item.videoId === track.videoId)) return playlist
      added = true
      const song = { videoId: track.videoId, title: track.title, artist: track.artist, thumbnail: track.thumbnail || '', duration: track.duration || '' }
      return { ...playlist, songs: [...playlist.songs, song], tracks: [...playlist.songs, song], updatedAt: Date.now() }
    }))
    return added
  }
  const removeFromPlaylist = (playlistId, videoId) => setPlaylists((current) => current.map((playlist) => playlist.id === playlistId ? { ...playlist, songs: playlist.songs.filter((track) => track.videoId !== videoId), tracks: playlist.songs.filter((track) => track.videoId !== videoId), updatedAt: Date.now() } : playlist))
  const playPlaylist = (tracks, shuffle = false) => {
    if (!tracks?.length) return
    const ordered = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks
    selectTrack(ordered[0], true, ordered)
    setActiveView('home')
  }

  const updateSearchQuery = (query) => setSearchState((current) => ({ ...current, query }))
  const submitSearch = (nextQuery) => {
    const trimmedQuery = nextQuery.trim()
    if (trimmedQuery.length < 2 || (searchState.isLoading && searchState.submittedQuery === trimmedQuery)) return
    setRecentSearches((current) => [trimmedQuery, ...current.filter((search) => search.toLowerCase() !== trimmedQuery.toLowerCase())].slice(0, 8))
    setSearchState((current) => ({ ...current, query: trimmedQuery, submittedQuery: trimmedQuery, mood: '', isLoading: true, error: '', requestId: current.requestId + 1 }))
    setActiveView('explore')
  }
  const submitMoodSearch = (mood) => {
    setSearchState((current) => ({ ...current, query: '', submittedQuery: '', mood, isLoading: true, error: '', requestId: current.requestId + 1 }))
    setActiveView('explore')
  }
  const clearSearch = () => setSearchState((current) => ({ ...current, query: '', submittedQuery: '', mood: '', isLoading: false, error: '' }))

  const handleCreateRoom = async () => {
    setConnectError('')
    try {
      const created = await createRoom(playback)
      setConnectRoom({ ...created, participantCount: 1 })
    } catch (error) { setConnectError(error.code === 'CONNECT_NOT_CONFIGURED' ? connectConfigMessage : 'Could not create a room. Check your connection and try again.') }
  }

  const handleJoinRoom = async (roomCode) => {
    setConnectError('')
    try {
      const joined = await joinRoom(roomCode)
      setConnectRoom({ ...joined, participantCount: 1 })
    } catch (error) { setConnectError(error.message || 'Could not join that room.') }
  }

  const handleLeaveRoom = async () => {
    const roomCode = connectRoom?.roomCode
    setConnectRoom(null)
    if (roomCode) await leaveRoom(roomCode).catch(() => {})
  }

  return <div className="app-shell">
    <button type="button" className="connect-entry" aria-label="Open Connect" onClick={() => { setConnectError(''); setIsConnectOpen(true) }}><UserRound size={16} /><span>Connect</span></button>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">k</span><span>Krovi</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}><Home size={19} /> Home</button><button className={activeView === 'explore' ? 'active' : ''} onClick={() => {
          setSearchState((current) => ({
            ...current,
            submittedQuery: '',
            mood: '',
            results: [],
            isLoading: false,
            error: '',
          }))
          setActiveView('explore')
        }}><Compass size={19} /> Explore</button><button className={activeView === 'library' ? 'active' : ''} onClick={() => setActiveView('library')}><Library size={19} /> Library</button>
      </nav>
      <div className="sidebar-note"><span>Keep a little room<br /><strong>for discovery.</strong></span><span className="note-spark">✦</span></div>
      <button className="profile-link" type="button"><UserRound size={18} /><span>Profile</span><ChevronRight size={15} /></button>
    </aside>

    <main className="main-content">
      {activeView === 'home' ? <PersonalizedHome recentTracks={recentTracks} likedTracks={likedTracks} playlists={playlists} recentSearches={recentSearches} onPlay={(track) => selectTrack(track, true)} onPlayAll={playPlaylist} onOpenLibrary={(tab) => { setActiveView('library'); void tab }} onOpenExplore={() => setActiveView('explore')} onSearchCategory={submitSearch} onRetryRecommendations={() => setActiveView('home')} /> : activeView === 'explore' ? <Explore query={searchState.query} submittedQuery={searchState.submittedQuery} mood={searchState.mood} results={searchState.results} isLoading={searchState.isLoading} error={searchState.error} recentSearches={recentSearches} onQueryChange={updateSearchQuery} onSubmitSearch={submitSearch} onSubmitMood={submitMoodSearch} onClearSearch={clearSearch} onClearRecentSearches={() => setRecentSearches([])} onSelectResult={selectYouTubeResult} onAddToQueue={addToQueue} onPlayNext={playNext} likedTracks={likedTracks} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} onBack={() => setActiveView('home')} /> : activeView === 'library' ? <Playlists playlists={playlists} savedTracks={likedTracks} recentTracks={recentTracks} availableTracks={[...likedTracks, ...recentTracks, ...queue].filter((track, index, all) => all.findIndex((item) => item.videoId === track.videoId) === index)} onCreate={createPlaylist} onUpdate={updatePlaylist} onDelete={deletePlaylist} onPlayTrack={(track, trackQueue) => selectTrack(track, true, trackQueue)} onPlayAll={playPlaylist} onAddTrack={addToPlaylist} onRemoveTrack={removeFromPlaylist} onAddToQueue={addToQueue} onPlayNext={playNext} onToggleLike={toggleLike} onRemoveRecent={removeRecentTrack} onExplore={() => setActiveView('explore')} onRequestPicker={setPlaylistPickerTrack} /> : null}
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation"><button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}><Home size={19} /><span>Home</span></button><button className={activeView === 'explore' ? 'active' : ''} onClick={() => {
      setSearchState((current) => ({
        ...current,
        submittedQuery: '',
        mood: '',
        results: [],
        isLoading: false,
        error: '',
      }))
      setActiveView('explore')
    }}><Compass size={19} /><span>Explore</span></button><button className={activeView === 'library' ? 'active' : ''} onClick={() => setActiveView('library')}><Library size={19} /><span>Library</span></button><button><UserRound size={19} /><span>Profile</span></button></nav>
    <Player playback={playback} currentTrack={currentTrack} queue={queue} currentQueueIndex={currentQueueIndex} playRequest={playRequest} onPlaybackChange={updatePlayback} onSelectTrack={selectTrack} onTrackStarted={handleTrackStarted} likedTracks={likedTracks} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} onRemoveFromQueue={removeFromQueue} onClearQueue={clearQueue} />
    <PlaylistPicker track={playlistPickerTrack} playlists={playlists} onAdd={addToPlaylist} onCreate={createPlaylist} onClose={() => setPlaylistPickerTrack(null)} />
    {isConnectOpen && <Connect room={connectRoom} isConfigured={isConnectConfigured} error={connectError} onCreate={handleCreateRoom} onJoin={handleJoinRoom} onLeave={handleLeaveRoom} onClose={() => setIsConnectOpen(false)} />}
  </div>
}

export default App
