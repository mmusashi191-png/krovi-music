export function isTrack(track) {
  return Boolean(track?.videoId && track?.title)
}

export function normalizeTrack(track) {
  return {
    videoId: String(track.videoId),
    title: String(track.title),
    artist: String(track.artist || 'YouTube'),
    thumbnail: typeof track.thumbnail === 'string' ? track.thumbnail : '',
    duration: typeof track.duration === 'string' ? track.duration : '',
  }
}

export function cleanTracks(value) {
  return Array.isArray(value) ? value.filter(isTrack).map(normalizeTrack) : []
}

export function uniqueTracks(tracks) {
  return [...new Map(cleanTracks(tracks).map((track) => [track.videoId, track])).values()]
}
