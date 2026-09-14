import { AlertCircle, Heart, ListPlus, Play, RefreshCw, SkipForward } from 'lucide-react'

function SearchResults({ results, isLoading, error, hasSearched, onRetry, onSelect, onAddToQueue, onPlayNext, likedTracks, onToggleLike, onRequestPlaylist }) {
  if (isLoading) return <div className="search-results skeleton-results" aria-label="Loading search results">{[1, 2, 3, 4].map((item) => <div className="result-skeleton" key={item}><span /><span /><span /></div>)}</div>
  if (error) return <div className="explore-state setup-state"><span className="setup-icon"><AlertCircle size={20} /></span><h3>That search hit a snag</h3><p>{error}</p><button type="button" className="primary-button retry-button" onClick={onRetry}><RefreshCw size={15} /> Try again</button></div>
  if (hasSearched && !results.length) return <div className="explore-state"><p>No videos found for that search.</p><small>Try an artist, song title, or album.</small></div>
  if (!hasSearched) return <div className="explore-state explore-empty"><span className="empty-orbit">✦</span><h3>Find something worth listening to</h3><p>Search YouTube for a song, artist, album, or video.</p></div>

  return <div className="search-results" aria-live="polite">{results.map((result) => {
    const liked = likedTracks?.some((track) => track.videoId === result.videoId)
    return <article className="result-card" key={result.videoId}>
      <button type="button" className="result-card-main" onClick={() => onSelect(result, true, results)}><span className="result-thumbnail">{result.thumbnail ? <img src={result.thumbnail} alt={`Thumbnail for ${result.title}`} /> : <span className="result-fallback" aria-label="No thumbnail available">K</span>}<span className="result-play"><Play size={16} fill="currentColor" /></span></span><span className="result-copy"><strong>{result.title}</strong><small>{result.artist}</small><span className="result-duration">{result.duration || 'YouTube video'}</span></span></button>
      <div className="result-actions"><button type="button" aria-label={`Add ${result.title} to queue`} title="Add to queue" onClick={() => onAddToQueue(result)}><ListPlus size={15} /></button><button type="button" aria-label={`Play ${result.title} next`} title="Play next" onClick={() => onPlayNext(result)}><SkipForward size={15} /></button><button type="button" aria-label={`Add ${result.title} to playlist`} title="Add to playlist" onClick={() => onRequestPlaylist(result)}><ListPlus size={15} /></button><button type="button" className={liked ? 'liked' : ''} aria-label={liked ? `Unlike ${result.title}` : `Like ${result.title}`} title={liked ? 'Unlike' : 'Like'} onClick={() => onToggleLike(result)}><Heart size={15} fill={liked ? 'currentColor' : 'none'} /></button></div>
    </article>
  })}</div>
}

export default SearchResults
