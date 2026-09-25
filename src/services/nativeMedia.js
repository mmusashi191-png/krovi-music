function bridge() {
  return typeof window !== 'undefined' ? window.KroviMedia : null
}

export function requestNativeMediaPermission() {
  try {
    bridge()?.requestNotificationPermission?.()
  } catch {
    // Native media controls are optional on non-Android clients.
  }
}

export function updateNativeMedia(track, isPlaying) {
  if (!track) return

  try {
    bridge()?.update?.(
      String(track.title || 'Krovi Music'),
      String(track.artist || 'YouTube'),
      Boolean(isPlaying),
    )
  } catch {
    // Keep web playback independent from native notification support.
  }
}

export function stopNativeMedia() {
  try {
    bridge()?.stop?.()
  } catch {
    // Keep web playback independent from native notification support.
  }
}
