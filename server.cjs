const express = require('express')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
const port = 8787
const youtubeSearchEndpoint = 'https://www.googleapis.com/youtube/v3/search'

app.get('/api/youtube/search', async (request, response) => {
  const query = request.query.q?.trim()

  if (!process.env.YOUTUBE_API_KEY) {
    return response.status(500).json({ error: 'YouTube API key is not configured.' })
  }

  if (!query) {
    return response.status(400).json({ error: 'A search query is required.' })
  }

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '12',
    q: query,
    key: process.env.YOUTUBE_API_KEY,
  })

  try {
    const youtubeResponse = await fetch(`${youtubeSearchEndpoint}?${searchParams}`)
    const payload = await youtubeResponse.json()

    if (!youtubeResponse.ok) {
      return response.status(youtubeResponse.status >= 500 ? 502 : youtubeResponse.status).json({
        error: payload.error?.message || 'YouTube search failed.',
      })
    }

    const results = (payload.items || []).map((item) => ({
      id: { videoId: item.id?.videoId },
      snippet: {
        title: item.snippet?.title,
        channelTitle: item.snippet?.channelTitle || 'YouTube channel',
        thumbnails: item.snippet?.thumbnails || {},
      },
    })).filter((item) => item.id.videoId && item.snippet.title)

    return response.json({ results })
  } catch {
    return response.status(502).json({ error: 'Unable to reach YouTube.' })
  }
})

app.listen(port, () => {
  console.log(`YouTube proxy listening on http://localhost:${port}`)
})