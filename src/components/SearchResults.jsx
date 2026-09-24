import { AlertCircle, Heart, ListPlus, Play, RefreshCw, SkipForward } from 'lucide-react'

export default function SearchResults({
  results,
  isLoading,
  error,
  hasSearched,
  onRetry,
  onSelect,
  onAddToQueue,
  onPlayNext,
  likedTracks,
  onToggleLike,
  onRequestPlaylist,
}) {
  if (isLoading) {
    return (
      <div className="results-list">
        {[1, 2, 3, 4, 5].map((item) => (
          <div className="result-skeleton" key={item}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-card">
        <AlertCircle size={21} />
        <h3>Search is unavailable.</h3>
        <p>{error}</p>
        <button type="button" className="primary-button" onClick={onRetry}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }

  if (hasSearched && !results.length) {
    return (
      <div className="state-card">
        <h3>No matches found.</h3>
        <p>Try a shorter phrase or the exact artist and song title.</p>
      </div>
    )
  }

  if (!hasSearched) return null

  return (
    <div className="results-list">
      {results.map((result, index) => {
        const liked = likedTracks.some((track) => track.videoId === result.videoId)

        return (
          <article
            className="result-card section-reveal"
            style={{ '--delay': index * 45 + 'ms' }}
            key={result.videoId}
          >
            <button type="button" className="result-main" onClick={() => onSelect(result)}>
              <span className="result-thumb">
                {result.thumbnail ? <img src={result.thumbnail} alt="" /> : <span>K</span>}
                <i><Play size={13} fill="currentColor" /></i>
              </span>
              <span className="result-copy">
                <strong>{result.title}</strong>
                <small>{result.artist}</small>
              </span>
            </button>

            <div className="result-actions">
              <button type="button" title="Queue" aria-label={'Add ' + result.title + ' to queue'} onClick={() => onAddToQueue(result)}>
                <ListPlus size={16} />
              </button>
              <button type="button" title="Play next" aria-label={'Play ' + result.title + ' next'} onClick={() => onPlayNext(result)}>
                <SkipForward size={16} />
              </button>
              <button type="button" title="Playlist" aria-label={'Add ' + result.title + ' to a playlist'} onClick={() => onRequestPlaylist(result)}>
                <span className="list-plus-mark">+</span>
              </button>
              <button type="button" className={liked ? 'liked' : ''} title={liked ? 'Unlike' : 'Like'} aria-label={liked ? 'Unlike ' + result.title : 'Like ' + result.title} onClick={() => onToggleLike(result)}>
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
