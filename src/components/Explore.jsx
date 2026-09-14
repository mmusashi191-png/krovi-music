import { useEffect, useState } from 'react'
import { ArrowLeft, Compass, Gamepad2, Headphones, Search, SlidersHorizontal, Sparkles, Sun, Target, Waves, Zap } from 'lucide-react'
import SearchResults from './SearchResults.jsx'

const localSuggestions = ['Chill', 'Focus', 'Lo-fi', 'Instrumental', 'Bollywood', 'Gaming', 'Workout', 'Rain sounds', 'Piano', 'Night drive']
const categoryCards = [
  { label: 'Chill', detail: 'Soft edges, easy hours', tone: 'pink', icon: Waves },
  { label: 'Focus', detail: 'A clear space to think', tone: 'lavender', icon: Target },
  { label: 'Night drive', detail: 'Neon roads, low lights', tone: 'blue', icon: Zap },
  { label: 'Instrumental', detail: 'Let the melody lead', tone: 'yellow', icon: Headphones },
  { label: 'Gaming', detail: 'Level up the energy', tone: 'peach', icon: Gamepad2 },
  { label: 'Workout', detail: 'Move with momentum', tone: 'rose', icon: Sun },
]

function Explore({ query, submittedQuery, mood, results, isLoading, error, recentSearches, onQueryChange, onSubmitSearch, onSubmitMood, onClearSearch, onClearRecentSearches, onSelectResult, onAddToQueue, onPlayNext, likedTracks, onToggleLike, onRequestPlaylist, onBack }) {
  const [isFocused, setIsFocused] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const matchingSuggestions = localSuggestions.filter((suggestion) => suggestion.toLowerCase().includes(debouncedQuery.toLowerCase())).slice(0, 6)
  const suggestions = debouncedQuery ? [...new Set([...recentSearches, ...matchingSuggestions])].slice(0, 6) : recentSearches
  const startSearch = (nextQuery) => { onQueryChange(nextQuery); onSubmitSearch(nextQuery); setIsFocused(false) }
  const startMood = (nextMood) => { onSubmitMood(nextMood); setIsFocused(false) }

  const submitSearch = (event) => {
    event.preventDefault()
    onSubmitSearch(query)
    setIsFocused(false)
  }

  return <div className="explore-screen">
    <div className="explore-heading"><div><p className="eyebrow">DISCOVER SOMETHING NEW</p><h1><span className="explore-heading-icon"><Compass size={25} /></span>Find your next feeling</h1><p className="subcopy">A softer way to wander through songs, artists, and live moments.</p></div><button type="button" className="explore-filter" aria-label="Explore settings"><SlidersHorizontal size={18} /></button></div>
    <form className="explore-search" onSubmit={submitSearch}><Search size={20} /><input value={query} onFocus={() => setIsFocused(true)} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search songs, artists, albums, videos..." aria-label="Search YouTube" /><button type="submit" aria-label="Search"><ArrowLeft size={18} className="search-submit-icon" /></button>{isFocused && suggestions.length > 0 && <div className="search-suggestion-panel" role="listbox">{suggestions.map((suggestion) => <button type="button" role="option" key={suggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => startSearch(suggestion)}><Search size={14} />{suggestion}</button>)}{!debouncedQuery && <button type="button" className="clear-searches" onMouseDown={(event) => event.preventDefault()} onClick={onClearRecentSearches}>Clear recent</button>}</div>}</form>
    <div className="explore-suggestions"><span><Sparkles size={14} /> Quick moods</span>{localSuggestions.slice(0, 6).map((suggestion) => <button type="button" key={suggestion} onClick={() => startSearch(suggestion)}>{suggestion}</button>)}</div>
    <section className="mood-section"><div className="section-heading"><div><p className="eyebrow">MAKE A LITTLE ROOM</p><h2>Explore by mood</h2></div></div><div className="mood-grid">{categoryCards.map(({ label, detail, tone, icon: Icon }) => <button type="button" className={`mood-card ${tone} ${mood === label ? 'active' : ''}`} key={label} onClick={() => startMood(label)}><span className="mood-card-icon"><Icon size={22} /></span><span><strong>{label}</strong><small>{detail}</small></span><ArrowLeft size={17} /></button>)}</div></section>
    <div className="explore-results-heading"><div><p className="eyebrow">{mood ? `${mood.toUpperCase()} DISCOVERY` : submittedQuery ? 'YOUTUBE RESULTS' : 'LIVE SEARCH'}</p><h2>{mood ? `Music for ${mood}` : submittedQuery ? `Results for “${submittedQuery}”` : 'Search the world of music'}</h2></div>{(submittedQuery || mood) && <button type="button" className="text-button" onClick={onClearSearch}>Clear search</button>}</div>
    <SearchResults results={results} isLoading={isLoading} error={error} hasSearched={Boolean(submittedQuery || mood)} onRetry={() => mood ? onSubmitMood(mood) : onSubmitSearch(submittedQuery)} onSelect={onSelectResult} onAddToQueue={onAddToQueue} onPlayNext={onPlayNext} likedTracks={likedTracks} onToggleLike={onToggleLike} onRequestPlaylist={onRequestPlaylist} />
    <button type="button" className="explore-mobile-back" onClick={onBack}><ArrowLeft size={16} /> Back home</button>
  </div>
}

export default Explore
