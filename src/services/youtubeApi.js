const DEFAULT_API_BASE_URL = 'https://krovi-music.onrender.com'
const SEARCH_TIMEOUT_MS = 12_000

function configuredBaseUrl() {
  const value = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (!value) return ''
  if (
    import.meta.env.PROD
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)
  ) {
    return ''
  }
  return value
}

function apiBaseUrl() {
  return configuredBaseUrl() || DEFAULT_API_BASE_URL
}

function searchEndpoint() {
  return apiBaseUrl() + '/api/youtube/search'
}

function normalizeResult(item) {
  const snippet = item?.snippet || item
  const videoId = item?.id?.videoId || (typeof item?.id === 'string' ? item.id : null)
  if (!videoId || !snippet?.title) return null

  return {
    id: videoId,
    videoId,
    title: String(snippet.title),
    artist: String(snippet.channelTitle || 'YouTube channel'),
    thumbnail: snippet.thumbnails?.high?.url
      || snippet.thumbnails?.medium?.url
      || snippet.thumbnails?.default?.url
      || '',
    duration: '',
    source: 'youtube',
  }
}

export async function searchYouTube(query, signal) {
  const value = String(query || '').trim()
  if (value.length < 2) return []

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  let response

  try {
    response = await fetch(searchEndpoint() + '?q=' + encodeURIComponent(value), {
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.error || 'YouTube search is temporarily unavailable.')
    error.code = response.status === 500 ? 'SERVER_CONFIG' : 'SEARCH_FAILED'
    throw error
  }

  return (payload?.results || payload?.items || [])
    .map(normalizeResult)
    .filter(Boolean)
}

export function warmYouTubeService() {
  fetch(apiBaseUrl() + '/health', { cache: 'no-store' }).catch(() => {})
}
