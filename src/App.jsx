import { useEffect, useState } from 'react'
import {
  ArrowUpRight, ChevronRight, CirclePlay, Compass, Download, Home,
  Library, ListMusic, MoreHorizontal, Play, Search, UserRound,
} from 'lucide-react'
import './App.css'
import Player from './components/Player.jsx'

const songs = [
  { title: 'Golden Hour', artist: 'JVKE', tone: 'pink', duration: '3:29', seconds: 209, initials: 'GH' },
  { title: 'Snooze', artist: 'SZA', tone: 'yellow', duration: '3:22', seconds: 202, initials: 'SZ' },
  { title: 'End of Beginning', artist: 'Djo', tone: 'lavender', duration: '2:39', seconds: 159, initials: 'DB' },
  { title: 'Good Days', artist: 'SZA', tone: 'blue', duration: '4:39', seconds: 279, initials: 'GD' },
]

const quickLinks = [
  { label: 'Your playlists', count: '12 playlists', icon: ListMusic, tone: 'pink' },
  { label: 'Liked songs', count: '284 songs', icon: HeartIcon, tone: 'yellow' },
  { label: 'Downloads', count: '48 songs', icon: Download, tone: 'lavender' },
]

function HeartIcon({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" /></svg>
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

function SongArtwork({ tone, initials }) {
  return <div className={`song-art ${tone}`}><span>{initials}</span></div>
}

function App() {
  const [search, setSearch] = useState('')
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [queue, setQueue] = useState([])
  const visibleSongs = songs.filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(search.toLowerCase()))

  const selectSong = (song) => {
    setCurrentSong(song)
    setIsPlaying(true)
    setProgress(0)
    setQueue(songs.filter((candidate) => candidate.title !== song.title))
  }

  const playNext = () => {
    if (!queue.length) return
    selectSong(queue[0])
  }

  const playPrevious = () => {
    if (!currentSong) return
    const currentIndex = songs.findIndex((song) => song.title === currentSong.title)
    selectSong(songs[(currentIndex - 1 + songs.length) % songs.length])
  }

  useEffect(() => {
    if (!isPlaying || !currentSong) return undefined
    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        if (currentProgress >= currentSong.seconds) {
          setIsPlaying(false)
          return currentSong.seconds
        }
        return currentProgress + 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [currentSong, isPlaying])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">k</span><span>Krovi</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className="active"><Home size={19} /> Home</button><button><Compass size={19} /> Explore</button><button><Library size={19} /> Library</button>
      </nav>
      <div className="sidebar-note"><span>Made for your<br /><strong>good mood.</strong></span><span className="note-spark">✦</span></div>
      <button className="profile-link"><UserRound size={18} /><span>Profile</span><ChevronRight size={15} /></button>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark">k</span><span>Krovi</span></div><div className="search-wrap"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search songs, artists, albums..." aria-label="Search music" /><kbd>/</kbd></div><button className="avatar" aria-label="Open profile">AL</button></header>
      <section className="welcome-row"><div><p className="eyebrow">Tuesday, September 14</p><h1>Good morning, Alex <span>✦</span></h1><p className="subcopy">Ease into your day with something beautiful.</p></div><button className="mood-button"><span className="sun-icon">☼</span> Your mood <strong>Calm</strong><ChevronRight size={16} /></button></section>

      <section className="featured-card"><div className="featured-copy"><span className="label">KROVI PICK <span>•</span> MADE FOR YOU</span><h2>Soft sounds for<br /><em>slow mornings.</em></h2><p>A gentle collection to start your day with a little more feeling.</p><button className="primary-button" onClick={() => selectSong(songs[0])}><CirclePlay size={20} fill="currentColor" /> Play playlist</button></div><MusicDoodle /><div className="featured-meta"><span>12 songs</span><span className="meta-dot" /><span>42 min</span><span className="mini-avatars"><i /><i /><i /> +9</span></div></section>

      <section className="section-block quick-section"><div className="section-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h2>Pick up where you left off</h2></div><button className="text-button">See all <ArrowUpRight size={15} /></button></div><div className="quick-grid">{quickLinks.map(({ label, count, icon: Icon, tone }) => <button className={`quick-card ${tone}`} key={label}><span className="quick-icon"><Icon size={21} /></span><span><strong>{label}</strong><small>{count}</small></span><ChevronRight size={17} /></button>)}</div></section>

      <section className="section-block recent-section"><div className="section-heading"><div><p className="eyebrow">LISTEN AGAIN</p><h2>Recently played</h2></div><button className="text-button">View history <ArrowUpRight size={15} /></button></div><div className="song-list">{visibleSongs.length ? visibleSongs.map((song) => <article className="song-row" key={song.title}><SongArtwork tone={song.tone} initials={song.initials} /><div className="song-info"><strong>{song.title}</strong><span>{song.artist}</span></div><span className="song-duration">{song.duration}</span><button className={`row-play ${currentSong?.title === song.title && isPlaying ? 'is-playing' : ''}`} aria-label={`Play ${song.title}`} onClick={() => currentSong?.title === song.title ? setIsPlaying((playing) => !playing) : selectSong(song)}>{currentSong?.title === song.title && isPlaying ? <span className="equalizer"><i /><i /><i /></span> : <Play size={15} fill="currentColor" />}</button><button className="more-button" aria-label={`More options for ${song.title}`}><MoreHorizontal size={19} /></button></article>) : <p className="empty-state">No songs found. Try another search.</p>}</div></section>
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation"><button className="active"><Home size={19} /><span>Home</span></button><button><Compass size={19} /><span>Explore</span></button><button><Library size={19} /><span>Library</span></button><button><UserRound size={19} /><span>Profile</span></button></nav>
    <Player song={currentSong} isPlaying={isPlaying} progress={progress} queue={queue} onTogglePlay={() => setIsPlaying((playing) => !playing)} onNext={playNext} onPrevious={playPrevious} onSeek={setProgress} onSelectSong={selectSong} />
  </div>
}

export default App
