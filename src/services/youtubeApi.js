const YOUTUBE_SEARCH_ENDPOINT = '/api/youtube/search'

function normalizeResult(item) {
  const snippet = item.snippet || item
  const videoId = item.id?.videoId || (typeof item.id === 'string' ? item.id : null)
  if (!videoId || !snippet?.title) return null

  return {
    id: videoId,
    videoId,
    title: snippet.title,
    artist: snippet.channelTitle || snippet.channelName || 'YouTube channel',
    thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || item.thumbnailUrl || '',
    duration: '',
    source: 'youtube',
  }
}

export async function searchYouTube(query, signal) {
  const response = await fetch(`${YOUTUBE_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, { signal })
  if (response.status === 404 || response.status === 501) {
    const error = new Error('YouTube search server endpoint is not configured.')
    error.code = 'YOUTUBE_NOT_CONFIGURED'
    throw error
  }
  if (!response.ok) throw new Error('YouTube search is temporarily unavailable.')

  if (!response.headers.get('content-type')?.includes('application/json')) {
    const error = new Error('YouTube search server endpoint is not configured.')
    error.code = 'YOUTUBE_NOT_CONFIGURED'
    throw error
  }

  const payload = await response.json()
  return (payload.items || payload.results || []).map(normalizeResult).filter(Boolean)
}

const moodQueries = {
  Chill: ['chill music mix', 'relaxing instrumental music', 'lofi chill music', 'ambient music mix', 'no talking music'],
  Focus: ['focus music', 'deep work instrumental', 'study music no lyrics', 'concentration music', 'piano focus music'],
  'Night drive': ['night drive music mix', 'synthwave night drive', 'atmospheric electronic music', 'late night chill mix'],
  Gaming: ['gaming music mix', 'gaming instrumental music', 'epic gaming soundtrack', 'electronic gaming mix', 'no commentary gaming music'],
  Workout: ['workout music mix', 'high energy gym music', 'motivational workout music', 'intense electronic music', 'rock workout mix'],
  Instrumental: ['instrumental music mix', 'piano instrumental', 'cinematic instrumental', 'acoustic instrumental'],
}

const preferredTerms = ['music', 'mix', 'playlist', 'audio', 'instrumental', 'soundtrack', 'radio', 'session', 'official']
const excludedTerms = ['tutorial', 'how to', 'shorts', 'short', 'vlog', 'reaction', 'review', 'gameplay', 'walkthrough', 'routine', 'exercise tips', 'workout tips']

function moodRelevance(result, mood) {
  const text = `${result.title} ${result.artist}`.toLowerCase()
  const moodTerms = mood.toLowerCase().split(/\s+/)
  return moodTerms.reduce((score, term) => score + (text.includes(term) ? 4 : 0), 0)
    + preferredTerms.reduce((score, term) => score + (text.includes(term) ? 2 : 0), 0)
    - excludedTerms.reduce((score, term) => score + (text.includes(term) ? 7 : 0), 0)
}

export async function searchMood(mood, signal) {
  const queries = moodQueries[mood] || [`${mood} music mix`, `${mood} instrumental music`, `${mood} official audio`]
  const settledQueries = await Promise.allSettled(queries.map((query) => searchYouTube(query, signal)))
  const successfulBatches = settledQueries.filter((result) => result.status === 'fulfilled').map((result) => result.value)
  if (!successfulBatches.length) {
    const failure = settledQueries.find((result) => result.status === 'rejected')?.reason || new Error('Mood search failed.')
    if (import.meta.env.DEV) console.error('[Krovi] Mood search failed:', failure)
    throw failure
  }
  const uniqueResults = [...new Map(successfulBatches.flat().map((result) => [result.videoId, result])).values()]
  const scoredResults = uniqueResults
    .map((result) => ({ result, score: moodRelevance(result, mood) }))
    .filter(({ score }) => score >= 0)
    .sort((left, right) => right.score - left.score)
    .map(({ result }) => result)
  return (scoredResults.length ? scoredResults : uniqueResults).slice(0, 24)
}
