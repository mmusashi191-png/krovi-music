import { ArrowLeft, ArrowRight, Clock3, Search, X } from 'lucide-react'
import SearchResults from './SearchResults.jsx'

const QUICK_SEARCHES = [
  ['Late night', 'music'],
  ['Focus', 'instrumental'],
  ['Chill', 'music'],
  ['Indie', 'music'],
  ['Bollywood', 'songs'],
  ['Gaming', 'music'],
]

export default function Explore({
  query,
  submittedQuery,
  results,
  isLoading,
  error,
  recentSearches,
  onQueryChange,
  onSubmitSearch,
  onClearSearch,
  onClearRecentSearches,
  onSelectResult,
  onAddToQueue,
  onPlayNext,
  likedTracks,
  onToggleLike,
  onRequestPlaylist,
  onBack,
}) {
  return (
    <div className="explore-screen page-enter">
      <header className="page-heading">
        <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={17} /> Home</button>
        <p className="eyebrow">DISCOVERY</p>
        <h1>Find the song.</h1>
        <p>One request at a time. Clean results, no competing panels.</p>
      </header>

      <form className="search-box" onSubmit={(event) => { event.preventDefault(); onSubmitSearch(query) }}>
        <Search size={19} />
        <input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Song, artist, album..."
          aria-label="Search music"
        />
        {query && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={onClearSearch}>
            <X size={17} />
          </button>
        )}
        <button type="submit" className="search-go" aria-label="Search"><ArrowRight size={18} /></button>
      </form>

      {!submittedQuery && recentSearches.length > 0 && (
        <section className="search-history section-reveal">
          <header className="section-title-row compact">
            <div>
              <p className="eyebrow">RECENT</p>
              <h2>Search again</h2>
            </div>
            <button type="button" className="text-link" onClick={onClearRecentSearches}>Clear</button>
          </header>
          <div className="history-list">
            {recentSearches.map((item) => (
              <button type="button" key={item} onClick={() => { onQueryChange(item); onSubmitSearch(item) }}>
                <Clock3 size={15} />
                <span>{item}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </section>
      )}

      {!submittedQuery && (
        <section className="quick-section section-reveal">
          <header className="section-title-row compact">
            <div>
              <p className="eyebrow">QUICK DIRECTIONS</p>
              <h2>Start somewhere.</h2>
            </div>
          </header>

          <div className="quick-list">
            {QUICK_SEARCHES.map(([label, suffix], index) => (
              <button
                type="button"
                key={label}
                style={{ '--delay': index * 50 + 'ms' }}
                onClick={() => onSubmitSearch(label + ' ' + suffix)}
              >
                <span className="quick-number">0{index + 1}</span>
                <strong>{label}</strong>
                <small>{suffix}</small>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {submittedQuery && (
        <section className="search-result-section section-reveal">
          <header className="result-heading">
            <div>
              <p className="eyebrow">RESULTS FOR</p>
              <h2>{submittedQuery}</h2>
            </div>
            <button type="button" className="text-link" onClick={onClearSearch}>New search</button>
          </header>

          <SearchResults
            results={results}
            isLoading={isLoading}
            error={error}
            hasSearched={Boolean(submittedQuery)}
            onRetry={() => onSubmitSearch(submittedQuery)}
            onSelect={onSelectResult}
            onAddToQueue={onAddToQueue}
            onPlayNext={onPlayNext}
            likedTracks={likedTracks}
            onToggleLike={onToggleLike}
            onRequestPlaylist={onRequestPlaylist}
          />
        </section>
      )}
    </div>
  )
}
