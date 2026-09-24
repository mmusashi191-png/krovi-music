import { ArrowRight, Heart, Play, Search } from 'lucide-react'

const DIRECTIONS = [
  ['Late night', 'soft electronic + slow songs'],
  ['Focus', 'instrumental + low distraction'],
  ['Chill', 'easy listening'],
  ['Indie', 'smaller voices + guitar'],
  ['Instrumental', 'let the melody lead'],
  ['Bollywood', 'familiar voices'],
]

function Artwork({ track }) {
  return (
    <span className="track-art">
      {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <span>{track.title.slice(0, 1).toUpperCase()}</span>}
    </span>
  )
}

function TrackRail({ tracks, onPlay }) {
  return (
    <div className="track-rail">
      {tracks.map((track, index) => (
        <button
          type="button"
          className="track-tile"
          key={track.videoId}
          style={{ '--delay': index * 45 + 'ms' }}
          onClick={() => onPlay(track)}
        >
          <Artwork track={track} />
          <span className="track-tile-copy">
            <strong>{track.title}</strong>
            <small>{track.artist}</small>
          </span>
          <span className="tile-play"><Play size={14} fill="currentColor" /></span>
        </button>
      ))}
    </div>
  )
}

export default function Home({
  recentTracks,
  likedTracks,
  playlists,
  onSubmitSearch,
  onOpenExplore,
  onPlay,
  onPlayAll,
}) {
  const hasMusic = recentTracks.length > 0 || likedTracks.length > 0

  return (
    <div className="home-screen page-enter">
      <section className="home-intro">
        <p className="eyebrow">A QUIET PLACE FOR MUSIC</p>
        <h1>Good songs deserve <em>good space.</em></h1>
        <p className="intro-copy">
          Search what you want, keep what matters, and make room for the next listen.
        </p>

        <button type="button" className="hero-search-button" onClick={onOpenExplore}>
          <span><Search size={18} /> Search music</span>
          <ArrowRight size={18} />
        </button>
      </section>

      {!hasMusic && (
        <section className="welcome-card section-reveal">
          <div className="welcome-mark">k</div>
          <div>
            <p className="eyebrow">YOUR SPACE</p>
            <h2>Start with one song.</h2>
            <p>Your recent plays and favourites will appear here as you use Krovi.</p>
          </div>
          <button type="button" className="inline-action" onClick={onOpenExplore}>
            Explore <ArrowRight size={15} />
          </button>
        </section>
      )}

      {recentTracks.length > 0 && (
        <section className="content-section section-reveal">
          <header className="section-title-row">
            <div>
              <p className="eyebrow">CONTINUE</p>
              <h2>Pick up where you left off</h2>
            </div>
            <button type="button" className="inline-action" onClick={() => onPlayAll(recentTracks)}>
              Play all <Play size={14} fill="currentColor" />
            </button>
          </header>
          <TrackRail tracks={recentTracks.slice(0, 10)} onPlay={onPlay} />
        </section>
      )}

      {likedTracks.length > 0 && (
        <section className="content-section section-reveal">
          <header className="section-title-row">
            <div>
              <p className="eyebrow">FAVOURITES</p>
              <h2>Keep the ones worth returning to</h2>
            </div>
            <button type="button" className="inline-action" onClick={() => onPlayAll(likedTracks)}>
              Play all <Play size={14} fill="currentColor" />
            </button>
          </header>
          <TrackRail tracks={likedTracks.slice(0, 10)} onPlay={onPlay} />
        </section>
      )}

      <section className="content-section section-reveal">
        <header className="section-title-row">
          <div>
            <p className="eyebrow">DIRECTIONS</p>
            <h2>Choose a mood and move.</h2>
          </div>
        </header>

        <div className="direction-list">
          {DIRECTIONS.map(([label, detail], index) => (
            <button
              type="button"
              key={label}
              className="direction-row"
              style={{ '--delay': index * 55 + 'ms' }}
              onClick={() => onSubmitSearch(label + ' music')}
            >
              <span className="direction-index">0{index + 1}</span>
              <span className="direction-copy">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="home-footnote section-reveal">
        <span><Heart size={16} fill={likedTracks.length ? 'currentColor' : 'none'} /></span>
        <p>{likedTracks.length} saved songs · {playlists.length} playlists</p>
      </section>
    </div>
  )
}
