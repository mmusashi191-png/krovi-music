import { useEffect, useState } from 'react'
import {
  ArrowUpRight, ChevronRight, Compass, Heart, Home, Library,
  ListPlus, Search, UserRound,
} from 'lucide-react'
import './App.css'
import Player from './components/Player.jsx'
import Explore from './components/Explore.jsx'
import Playlists, { PlaylistPicker } from './components/Playlists.jsx'
import { searchMood, searchYouTube } from './services/youtubeApi.js'

const RECENT_STORAGE_KEY = 'krovi-recently-played'
const LIKED_STORAGE_KEY = 'krovi-liked-songs'
const QUEUE_STORAGE_KEY = 'krovi-queue'
const PLAYLISTS_STORAGE_KEY = 'krovi-playlists'
const SEARCHES_STORAGE_KEY = 'krovi-recent-searches'

function readStoredTracks(key) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(stored) ? stored.filter((track) => track?.videoId && track.title && track.artist) : []
  } catch {
    return []
  }
}

function readStoredPlaylists() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYLISTS_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((playlist) => playlist?.id && playlist.name && Array.isArray(playlist.tracks)) : []
  } catch { return [] }
}

function readStoredSearches() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SEARCHES_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((search) => typeof search === 'string' && search.trim()).slice(0, 8) : []
  } catch { return [] }
}

function isPlayableTrack(track) {
  return Boolean(track?.videoId && track.title && track.artist)
}

function TrackCard({ track, onPlay, onToggleLike, isLiked, onRequestPlaylist }) {
  return <article className="library-track-card">
    <button type="button" className="library-track-main" onClick={() => onPlay(track)}><SongArtwork track={track} /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button>
    <button type="button" className={`heart-button ${isLiked ? 'liked' : ''}`} aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`} title={isLiked ? 'Unlike' : 'Like'} onClick={() => onToggleLike(track)}><Heart size={16} fill={isLiked ? 'currentColor' : 'none'} /></button>
    <button type="button" className="heart-button" aria-label={`Add ${track.title} to playlist`} title="Add to playlist" onClick={() => onRequestPlaylist(track)}><ListPlus size={16} /></button>
  </article>
}

function getLibraryStats(playlists, likedTracks, queue) {
  return { playlistCount: playlists.length, likedCount: likedTracks.length, queuedCount: queue.length }
}

function MusicDoodle() {
  return <svg className="music-doodle" viewBox="0 0 350 220" aria-hidden="true">
    <path className="player-cable" d="M143 157c-26 20-60 19-79 2-15-14-9-33 8-34 14-1 19 13 11 22-7 8-20 9-31 4" />
    <path className="player-cable cable-highlight" d="M143 157c-26 20-60 19-79 2-15-14-9-33 8-34" />
    <rect className="player-body" x="119" y="40" width="119" height="126" rx="22" transform="rotate(6 119 40)" />
    <rect className="player-edge" x="125" y="47" width="107" height="114" rx="17" transform="rotate(6 125 47)" />
    <rect className="player-screen" x="143" y="66" width="71" height="40" rx="8" transform="rotate(6 143 66)" />
    <path className="screen-wave" d="M154 88c7-11 11 9 18-1s11-7 17 1 11-5 18-6" />
    <circle className="player-knob" cx="154" cy="130" r="10" /><path className="player-play" d="m151 125 8 5-8 5z" />
    <path className="player-speaker" d="M180 126h26m-24 7h21m-18 7h15" />
    <path className="star star-one" d="m264 47 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
    <path className="star star-two" d="m287 105 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    <circle className="player-dot" cx="270" cy="151" r="5" /><path className="player-dash" d="M99 68h12m-4-6v12" />
  </svg>
}

function SongArtwork({ track }) {
  return <div className={`song-art ${track.tone}`}>{track.thumbnail ? <img src={track.thumbnail} alt={`Thumbnail for ${track.title}`} /> : <span>{track.initials}</span>}</div>
}

function App() {
  const [activeView, setActiveView] = useState('home')
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState(() => readStoredTracks(QUEUE_STORAGE_KEY))
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1)
  const [playRequest, setPlayRequest] = useState(null)
  const [recentTracks, setRecentTracks] = useState(() => readStoredTracks(RECENT_STORAGE_KEY).slice(0, 20))
  const [likedTracks, setLikedTracks] = useState(() => readStoredTracks(LIKED_STORAGE_KEY))
  const [playlists, setPlaylists] = useState(readStoredPlaylists)
  const [playlistPickerTrack, setPlaylistPickerTrack] = useState(null)
  const [searchState, setSearchState] = useState({ query: '', submittedQuery: '', results: [], isLoading: false, error: '', requestId: 0, mood: '' })
  const [recentSearches, setRecentSearches] = useState(readStoredSearches)
  const libraryStats = getLibraryStats(playlists, likedTracks, queue)

  useEffect(() => { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentTracks.slice(0, 20))) }, [recentTracks])
  useEffect(() => { window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedTracks)) }, [likedTracks])
  useEffect(() => { window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.filter(isPlayableTrack))) }, [queue])
  useEffect(() => { window.localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists)) }, [playlists])
  useEffect(() => { window.localStorage.setItem(SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches.slice(0, 8))) }, [recentSearches])

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
    const trackQueue = nextQueue || (queue.length ? queue : [track])
    const trackIndex = trackQueue.findIndex((candidate) => candidate.videoId === track.videoId)
    setCurrentTrack(track)
    setQueue(trackQueue)
    setCurrentQueueIndex(trackIndex)
    setPlayRequest(shouldPlay ? { videoId: track.videoId, token: Date.now() } : null)
  }

  const selectYouTubeResult = (result, shouldPlay = false, resultQueue = null) => {
    selectTrack(result, shouldPlay, resultQueue)
    setActiveView('home')
  }

  const openExplore = () => setActiveView('explore')

  const addToQueue = (track) => {
    if (!isPlayableTrack(track)) return
    setQueue((currentQueue) => currentQueue.some((queuedTrack) => queuedTrack.videoId === track.videoId) ? currentQueue : [...currentQueue, track])
  }

  const playNext = (track) => {
    if (!isPlayableTrack(track)) return
    setQueue((currentQueue) => {
      if (currentQueue.some((queuedTrack) => queuedTrack.videoId === track.videoId)) return currentQueue
      const insertAt = currentTrack ? Math.max(0, currentQueueIndex + 1) : currentQueue.length
      return [...currentQueue.slice(0, insertAt), track, ...currentQueue.slice(insertAt)]
    })
  }

  const removeFromQueue = (videoId) => {
    const removedIndex = queue.findIndex((track) => track.videoId === videoId)
    setQueue((currentQueue) => currentQueue.filter((track) => track.videoId !== videoId))
    if (removedIndex >= 0) setCurrentQueueIndex((index) => removedIndex < index ? index - 1 : index)
  }

  const clearQueue = () => {
    setQueue(currentTrack ? [currentTrack] : [])
    setCurrentQueueIndex(currentTrack ? 0 : -1)
  }

  const toggleLike = (track) => {
    if (!isPlayableTrack(track)) return
    setLikedTracks((currentLiked) => currentLiked.some((likedTrack) => likedTrack.videoId === track.videoId)
      ? currentLiked.filter((likedTrack) => likedTrack.videoId !== track.videoId)
      : [...currentLiked, track])
  }

  const handleTrackStarted = (track) => {
    if (!isPlayableTrack(track)) return
    const recentTrack = { videoId: track.videoId, title: track.title, artist: track.artist, thumbnail: track.thumbnail || '', lastPlayedAt: new Date().toISOString() }
    setRecentTracks((currentRecent) => [recentTrack, ...currentRecent.filter((item) => item.videoId !== track.videoId)].slice(0, 20))
  }

  const playLibraryTrack = (track) => {
    const libraryQueue = queue.length ? queue : [track]
    selectTrack(track, true, libraryQueue.some((item) => item.videoId === track.videoId) ? libraryQueue : [...libraryQueue, track])
    setActiveView('home')
  }

  const isLiked = (track) => likedTracks.some((likedTrack) => likedTrack.videoId === track.videoId)

  const createPlaylist = (details) => {
    const now = Date.now()
    const playlist = { id: `playlist-${now}-${Math.random().toString(36).slice(2, 8)}`, name: details.name.trim(), description: details.description?.trim() || '', coverImage: details.coverImage?.trim() || '', createdAt: now, updatedAt: now, tracks: [] }
    setPlaylists((current) => [...current, playlist])
    return playlist
  }
  const updatePlaylist = (id, details) => setPlaylists((current) => current.map((playlist) => playlist.id === id ? { ...playlist, ...details, updatedAt: Date.now() } : playlist))
  const deletePlaylist = (id) => { if (window.confirm('Delete this playlist? Your liked and recent songs will stay safe.')) setPlaylists((current) => current.filter((playlist) => playlist.id !== id)) }
  const addToPlaylist = (playlistId, track) => {
    if (!isPlayableTrack(track)) return false
    let added = false
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId || playlist.tracks.some((item) => item.videoId === track.videoId)) return playlist
      added = true
      return { ...playlist, tracks: [...playlist.tracks, { videoId: track.videoId, title: track.title, artist: track.artist, thumbnail: track.thumbnail || '' }], updatedAt: Date.now() }
    }))
    return added
  }
  const removeFromPlaylist = (playlistId, videoId) => setPlaylists((current) => current.map((playlist) => playlist.id === playlistId ? { ...playlist, tracks: playlist.tracks.filter((track) => track.videoId !== videoId), updatedAt: Date.now() } : playlist))
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

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">k</span><span>Krovi</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}><Home size={19} /> Home</button><button className={activeView === 'explore' ? 'active' : ''} onClick={() => setActiveView('explore')}><Compass size={19} /> Explore</button><button className={activeView === 'library' ? 'active' : ''} onClick={() => setActiveView('library')}><Library size={19} /> Library</button>
      </nav>
      <div className="sidebar-note"><span>Keep a little room<br /><strong>for discovery.</strong></span><span className="note-spark">✦</span></div>
      <button className="profile-link" type="button"><UserRound size={18} /><span>Profile</span><ChevronRight size={15} /></button>
    </aside>

    <main className="main-content">
      {activeView === 'explore' ? <Explore query={searchState.query} submittedQuery={searchState.submittedQuery} mood={searchState.mood} results={searchState.results} isLoading={searchState.isLoading} error={searchState.error} recentSearches={recentSearches} onQueryChange={updateSearchQuery} onSubmitSearch={submitSearch} onSubmitMood={submitMoodSearch} onClearSearch={clearSearch} onClearRecentSearches={() => setRecentSearches([])} onSelectResult={selectYouTubeResult} onAddToQueue={addToQueue} onPlayNext={playNext} likedTracks={likedTracks} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} onBack={() => setActiveView('home')} /> : activeView === 'library' ? <Playlists playlists={playlists} availableTracks={[...likedTracks, ...recentTracks, ...queue].filter((track, index, all) => all.findIndex((item) => item.videoId === track.videoId) === index)} onCreate={createPlaylist} onUpdate={updatePlaylist} onDelete={deletePlaylist} onPlayTrack={(track, trackQueue) => selectTrack(track, true, trackQueue)} onPlayAll={playPlaylist} onAddTrack={addToPlaylist} onRemoveTrack={removeFromPlaylist} onRequestPicker={setPlaylistPickerTrack} /> : <>
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark">k</span><span>Krovi</span></div><form className="search-wrap" onSubmit={(event) => { event.preventDefault(); submitSearch(searchState.query) }}><Search size={19} /><input value={searchState.query} onChange={(event) => updateSearchQuery(event.target.value)} placeholder="Search songs, artists, albums..." aria-label="Search music" /><kbd>/</kbd></form><button className="avatar" aria-label="Open profile">AL</button></header>
        <section className="welcome-row"><div><p className="eyebrow">YOUR MUSIC SPACE</p><h1>Make room for a good song <span>✦</span></h1><p className="subcopy">Search YouTube, save favourites, and build your own queue.</p></div></section>

        <section className="featured-card"><button type="button" className="hero-explore-button" onClick={openExplore}><Compass size={16} /> Explore</button><div className="featured-copy"><span className="label">A QUIET START</span><h2>Find something<br /><em>worth replaying.</em></h2><p>Explore music from YouTube and let your library grow from what you actually choose.</p><button className="primary-button" onClick={openExplore}><Compass size={19} /> Open Explore</button></div><MusicDoodle /></section>

        <section className="section-block quick-section"><div className="section-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h2>What you have saved</h2></div><button className="text-button" onClick={() => setActiveView('library')}>Open library <ArrowUpRight size={15} /></button></div><div className="quick-grid"><button className="quick-card pink" onClick={() => setActiveView('library')}><span className="quick-icon"><Heart size={21} /></span><span><strong>Liked songs</strong><small>{libraryStats.likedCount ? `${libraryStats.likedCount} saved` : 'Nothing saved yet'}</small></span><ChevronRight size={17} /></button><button className="quick-card yellow" onClick={() => setActiveView('library')}><span className="quick-icon"><ListPlus size={21} /></span><span><strong>Playlists</strong><small>{libraryStats.playlistCount ? `${libraryStats.playlistCount} created` : 'Create your first one'}</small></span><ChevronRight size={17} /></button><button className="quick-card lavender" onClick={openExplore}><span className="quick-icon"><Compass size={21} /></span><span><strong>Explore music</strong><small>Search something new</small></span><ChevronRight size={17} /></button></div></section>

        <section className="section-block recent-section"><div className="section-heading"><div><p className="eyebrow">LISTEN AGAIN</p><h2>Recently played</h2></div>{recentTracks.length > 0 && <button className="text-button" onClick={() => setActiveView('library')}>View library <ArrowUpRight size={15} /></button>}</div>{recentTracks.length > 0 ? <div className="library-grid">{recentTracks.slice(0, 8).map((track) => <TrackCard key={track.videoId} track={track} onPlay={playLibraryTrack} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} isLiked={isLiked(track)} />)}</div> : <div className="home-empty-state"><p>Your recently played songs will appear here.</p><button type="button" className="text-button" onClick={openExplore}>Start listening <ArrowUpRight size={15} /></button></div>}</section>
        {likedTracks.length > 0 && <section className="section-block liked-section"><div className="section-heading"><div><p className="eyebrow">YOUR FAVOURITES</p><h2>Liked songs</h2></div><button className="text-button" onClick={() => setActiveView('library')}>See all <ArrowUpRight size={15} /></button></div><div className="library-grid">{likedTracks.slice(0, 4).map((track) => <TrackCard key={track.videoId} track={track} onPlay={playLibraryTrack} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} isLiked />)}</div></section>}
        {queue.filter((_, index) => index > currentQueueIndex).length > 0 && <section className="section-block queue-preview"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2>Queue</h2></div><button className="text-button" onClick={() => setActiveView('home')}>Open player <ArrowUpRight size={15} /></button></div><div className="library-grid">{queue.filter((_, index) => index > currentQueueIndex).slice(0, 4).map((track) => <TrackCard key={track.videoId} track={track} onPlay={playLibraryTrack} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} isLiked={isLiked(track)} />)}</div></section>}
      </>}
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation"><button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}><Home size={19} /><span>Home</span></button><button className={activeView === 'explore' ? 'active' : ''} onClick={() => setActiveView('explore')}><Compass size={19} /><span>Explore</span></button><button className={activeView === 'library' ? 'active' : ''} onClick={() => setActiveView('library')}><Library size={19} /><span>Library</span></button><button><UserRound size={19} /><span>Profile</span></button></nav>
    <Player currentTrack={currentTrack} queue={queue} currentQueueIndex={currentQueueIndex} playRequest={playRequest} onSelectTrack={selectTrack} onTrackStarted={handleTrackStarted} likedTracks={likedTracks} onToggleLike={toggleLike} onRequestPlaylist={setPlaylistPickerTrack} onRemoveFromQueue={removeFromQueue} onClearQueue={clearQueue} />
    <PlaylistPicker track={playlistPickerTrack} playlists={playlists} onAdd={addToPlaylist} onCreate={createPlaylist} onClose={() => setPlaylistPickerTrack(null)} />
  </div>
}

export default App
