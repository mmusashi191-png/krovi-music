import { useState } from 'react'
import {
  ChevronDown,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react'

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

function PlayerArtwork({ song, large = false }) {
  return <div className={`player-art ${song.tone} ${large ? 'large' : ''}`}><span>{song.initials}</span><i /><b /></div>
}

function Player({ song, isPlaying, progress, queue, onTogglePlay, onNext, onPrevious, onSeek, onSelectSong }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!song) return null

  const openExpanded = () => setIsExpanded(true)
  const closeExpanded = () => setIsExpanded(false)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') openExpanded()
  }

  return <>
    <section className="player-dock" aria-label="Music player">
      <div className="player-dock-inner">
        <div className="player-current" role="button" tabIndex="0" onClick={openExpanded} onKeyDown={handleKeyDown}>
          <PlayerArtwork song={song} />
          <span className="player-track"><strong>{song.title}</strong><small>{song.artist}</small></span>
        </div>
        <div className="player-controls">
          <button type="button" className="player-icon-button player-skip" aria-label="Previous song" onClick={onPrevious}><SkipBack size={17} fill="currentColor" /></button>
          <button type="button" className="player-main-button" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={onTogglePlay}>{isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button type="button" className="player-icon-button player-skip" aria-label="Next song" onClick={onNext}><SkipForward size={17} fill="currentColor" /></button>
        </div>
        <div className="player-progress-wrap">
          <span>{formatTime(progress)}</span>
          <input className="player-progress" type="range" min="0" max={song.seconds} value={progress} onChange={(event) => onSeek(Number(event.target.value))} aria-label="Playback progress" style={{ '--progress': `${(progress / song.seconds) * 100}%` }} />
          <span>{song.duration}</span>
        </div>
        <button type="button" className="player-expand-button" aria-label="Open full player" onClick={openExpanded}><Maximize2 size={17} /></button>
      </div>
    </section>

    {isExpanded && <div className="player-overlay" role="presentation" onClick={closeExpanded}>
      <section className="expanded-player" role="dialog" aria-modal="true" aria-label={`${song.title} player`} onClick={(event) => event.stopPropagation()}>
        <header className="expanded-header"><button type="button" className="expanded-close" aria-label="Close player" onClick={closeExpanded}><ChevronDown size={21} /></button><span>NOW PLAYING</span><button type="button" className="expanded-queue-label" aria-label="Queue"><ListMusic size={19} /></button></header>
        <div className="expanded-content">
          <PlayerArtwork song={song} large />
          <p className="expanded-eyebrow">KROVI SESSION</p>
          <h2>{song.title}</h2><p className="expanded-artist">{song.artist}</p>
          <div className="expanded-progress"><input className="player-progress" type="range" min="0" max={song.seconds} value={progress} onChange={(event) => onSeek(Number(event.target.value))} aria-label="Playback progress" style={{ '--progress': `${(progress / song.seconds) * 100}%` }} /><div><span>{formatTime(progress)}</span><span>{song.duration}</span></div></div>
          <div className="expanded-controls"><button type="button" aria-label="Previous song" onClick={onPrevious}><SkipBack size={22} fill="currentColor" /></button><button type="button" className="expanded-play" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={onTogglePlay}>{isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}</button><button type="button" aria-label="Next song" onClick={onNext}><SkipForward size={22} fill="currentColor" /></button></div>
        </div>
        <aside className="queue-panel"><div className="queue-heading"><div><p className="expanded-eyebrow">UP NEXT</p><h3>Your queue</h3></div><span>{queue.length} songs</span></div>{queue.length ? <div className="queue-list">{queue.map((queuedSong) => <button type="button" className="queue-song" key={queuedSong.title} onClick={() => { onSelectSong(queuedSong); closeExpanded() }}><PlayerArtwork song={queuedSong} /><span><strong>{queuedSong.title}</strong><small>{queuedSong.artist}</small></span><em>{queuedSong.duration}</em></button>)}</div> : <p className="queue-empty">Your queue is clear.</p>}</aside>
      </section>
    </div>}
  </>
}

export default Player
