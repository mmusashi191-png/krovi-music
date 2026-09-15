import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronRight, Compass, Heart, ListPlus, Play, Search } from 'lucide-react'
import { searchYouTube } from '../services/youtubeApi.js'

const RECOMMENDATION_CACHE_KEY = 'krovi-home-recommendations-v1'
const DISCOVERY_CATEGORIES = ['Chill', 'Phonk', 'Bollywood', 'Hip-hop', 'Lo-fi', 'Gaming', 'Instrumental']

function readRecommendationCache() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECOMMENDATION_CACHE_KEY) || '{}')
    return stored && typeof stored === 'object' ? stored : {}
  } catch {
    window.localStorage.removeItem(RECOMMENDATION_CACHE_KEY)
    return {}
  }
}

function isPlayableTrack(track) {
  return Boolean(track?.videoId && track.title && track.artist)
}

function uniqueTracks(tracks) {
  return [...new Map(tracks.filter(isPlayableTrack).map((track) => [track.videoId, track])).values()]
}

function titleTerms(tracks) {
  return uniqueTracks(tracks).slice(0, 4).flatMap((track) => `${track.artist} ${track.title}`.split(/[^a-zA-Z0-9]+/).filter((term) => term.length > 2)).slice(0, 8)
}

function SongArtwork({ track }) {
  return <div className={`song-art ${track.tone || 'blue'}`}>{track.thumbnail ? <img src={track.thumbnail} alt="" /> : <span>{track.initials || 'YT'}</span>}</div>
}

function HomeSongCard({ track, onPlay }) {
  return <button type="button" className="home-song-card" onClick={() => onPlay(track)}><SongArtwork track={track} /><span><strong>{track.title}</strong><small>{track.artist}</small></span><Play size={15} fill="currentColor" /></button>
}

function HomeSection({ eyebrow, title, action, children }) {
  return <section className="home-personal-section"><div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>{children}</section>
}

function SkeletonRow() {
  return <div className="home-recommendation-skeleton" aria-label="Loading recommendations"><span /><span /><span /></div>
}

function Home({ recentTracks, likedTracks, playlists, recentSearches, onPlay, onPlayAll, onOpenLibrary, onOpenExplore, onSearchCategory, onRetryRecommendations }) {
  const [recommendations, setRecommendations] = useState([])
  const [recommendationState, setRecommendationState] = useState('idle')
  const [retryToken, setRetryToken] = useState(0)
  const personalizedTracks = uniqueTracks([...recentTracks, ...likedTracks])
  const hasActivity = personalizedTracks.length > 0 || recentSearches.length > 0 || playlists.length > 0
  const recommendationQuery = [...recentSearches.slice(0, 2), ...titleTerms(personalizedTracks).slice(0, 3)].join(' music ')

  useEffect(() => {
    let cancelled = false
    if (!hasActivity || !recommendationQuery) { queueMicrotask(() => { if (!cancelled) { setRecommendations([]); setRecommendationState('idle') } }); return undefined }
    const cache = readRecommendationCache()
    const cached = cache[recommendationQuery]
    if (cached && cached.expiresAt > Date.now()) { queueMicrotask(() => { if (!cancelled) { setRecommendations(cached.results || []); setRecommendationState('ready') } }); return undefined }
    const controller = new AbortController()
    const load = async () => {
      setRecommendationState('loading')
      try {
        const results = await searchYouTube(recommendationQuery, controller.signal)
        const filtered = uniqueTracks(results).filter((track) => !personalizedTracks.some((item) => item.videoId === track.videoId)).slice(0, 8)
        if (cancelled) return
        setRecommendations(filtered)
        setRecommendationState('ready')
        const nextCache = readRecommendationCache()
        nextCache[recommendationQuery] = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, results: filtered }
        window.localStorage.setItem(RECOMMENDATION_CACHE_KEY, JSON.stringify(nextCache))
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') setRecommendationState('error')
      }
    }
    load()
    return () => { cancelled = true; controller.abort() }
  }, [hasActivity, personalizedTracks, recommendationQuery, retryToken])

  const continueListening = uniqueTracks(recentTracks).slice(0, 8)
  const quickMix = uniqueTracks([...recentTracks, ...likedTracks]).slice(0, 8)
  const madeForYou = uniqueTracks(recommendations).filter((track) => !quickMix.some((item) => item.videoId === track.videoId)).slice(0, 8)

  return <>
    <header className="topbar"><div className="mobile-brand"><span className="brand-mark">k</span><span>Krovi</span></div><form className="search-wrap" onSubmit={(event) => { event.preventDefault(); onOpenExplore() }}><Search size={19} /><input placeholder="Search songs, artists, albums..." aria-label="Search music" /><kbd>/</kbd></form><button className="avatar" aria-label="Open profile">AL</button></header>
    <section className="welcome-row"><div><p className="eyebrow">YOUR MUSIC SPACE</p><h1>Make room for a good song <span>✦</span></h1><p className="subcopy">A softer place for the songs you keep coming back to.</p></div></section>
    <section className="featured-card"><div className="featured-copy"><span className="label">A QUIET START</span><h2>Find something<br /><em>worth replaying.</em></h2><p>Search YouTube, save favourites, and build your own queue.</p></div><svg className="music-doodle" viewBox="0 0 350 220" aria-hidden="true"><rect className="player-body" x="119" y="40" width="119" height="126" rx="22" transform="rotate(6 119 40)" /><rect className="player-edge" x="125" y="47" width="107" height="114" rx="17" transform="rotate(6 125 47)" /><rect className="player-screen" x="143" y="66" width="71" height="40" rx="8" transform="rotate(6 143 66)" /><path className="screen-wave" d="M154 88c7-11 11 9 18-1s11-7 17 1 11-5 18-6" /><circle className="player-knob" cx="154" cy="130" r="10" /><path className="player-play" d="m151 125 8 5-8 5z" /></svg></section>
    <HomeSection eyebrow="CONTINUE LISTENING" title="Pick up where you left off" action={continueListening.length > 0 && <button className="text-button" onClick={() => onPlayAll(continueListening)}>Play all <Play size={14} /></button>}>
      {continueListening.length ? <div className="home-song-row">{continueListening.map((track) => <HomeSongCard key={track.videoId} track={track} onPlay={onPlay} />)}</div> : <div className="home-personal-empty"><p>Your listening history will appear here.</p><button type="button" className="text-button" onClick={onOpenExplore}>Explore music <ArrowUpRight size={14} /></button></div>}
    </HomeSection>
    <HomeSection eyebrow="QUICK MIX" title="A little of what you like" action={quickMix.length > 0 && <button className="text-button" onClick={() => onPlayAll(quickMix)}>Play all <Play size={14} /></button>}>
      {quickMix.length ? <div className="home-song-row">{quickMix.map((track) => <HomeSongCard key={track.videoId} track={track} onPlay={onPlay} />)}</div> : <div className="home-personal-empty"><p>Save or play a song to shape your mix.</p><button type="button" className="text-button" onClick={onOpenExplore}>Find music <ArrowUpRight size={14} /></button></div>}
    </HomeSection>
    <HomeSection eyebrow="MADE FOR YOU" title={hasActivity ? 'Something new to try' : 'Start your listening story'} action={recommendationState === 'error' && <button className="text-button" onClick={() => { setRetryToken((token) => token + 1); onRetryRecommendations?.() }}>Retry <ArrowUpRight size={14} /></button>}>
      {recommendationState === 'loading' ? <div className="home-song-row">{[1, 2, 3].map((item) => <SkeletonRow key={item} />)}</div> : madeForYou.length ? <div className="home-song-row">{madeForYou.map((track) => <HomeSongCard key={track.videoId} track={track} onPlay={onPlay} />)}</div> : <div className="home-personal-empty"><p>{hasActivity && recommendationState === 'error' ? 'Recommendations are taking a pause.' : 'Explore a category to get started.'}</p><button type="button" className="text-button" onClick={onOpenExplore}>Open Explore <Compass size={14} /></button></div>}
    </HomeSection>
    <HomeSection eyebrow="DISCOVER" title="Find a new feeling"><div className="home-category-row">{DISCOVERY_CATEGORIES.map((category) => <button type="button" className="home-category-chip" key={category} onClick={() => onSearchCategory(category)}>{category}<ChevronRight size={14} /></button>)}</div></HomeSection>
    <HomeSection eyebrow="YOUR COLLECTION" title="Keep your favourites close"><div className="home-library-shortcuts"><button type="button" onClick={() => onOpenLibrary('saved')}><Heart size={18} /><span><strong>Favourites</strong><small>{likedTracks.length} saved</small></span></button><button type="button" onClick={() => onOpenLibrary('playlists')}><ListPlus size={18} /><span><strong>Playlists</strong><small>{playlists.length} created</small></span></button><button type="button" onClick={() => onOpenLibrary('recent')}><Play size={18} /><span><strong>Recently played</strong><small>{recentTracks.length} tracks</small></span></button></div></HomeSection>
  </>
}

export default Home
