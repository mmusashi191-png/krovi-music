import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Heart,
  ListMusic,
  LoaderCircle,
  Maximize2,
  Move,
  Pause,
  Play,
  Plus,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  requestNativeMediaPermission,
  startNativeMedia,
  stopNativeMedia,
} from '../services/nativeMedia.js'

let youtubeApiPromise

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady
      const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')

      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        resolve(window.YT)
      }

      if (!script) {
        const nextScript = document.createElement('script')
        nextScript.src = 'https://www.youtube.com/iframe_api'
        nextScript.async = true
        document.head.appendChild(nextScript)
      }
    })
  }

  return youtubeApiPromise
}

function formatTime(value) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

function Artwork({ track, large = false }) {
  const label = track?.title?.trim()?.slice(0, 1)?.toUpperCase() || 'K'
  return (
    <div className={'player-art ' + (large ? 'large' : '')}>
      {track?.thumbnail ? <img src={track.thumbnail} alt="" /> : <span>{label}</span>}
      <i aria-hidden="true" />
    </div>
  )
}

function QueueDrawer({ queue, currentIndex, onSelect, onRemove, onClear, onClose }) {
  return (
    <div className="queue-overlay" onClick={onClose}>
      <section
        className="queue-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Playback queue"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-header">
          <div>
            <p className="eyebrow">UP NEXT</p>
            <h2>Queue</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close queue" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        {queue.length ? (
          <div className="queue-list">
            {queue.map((item, index) => (
              <div className={'queue-row ' + (index === currentIndex ? 'current' : '')} key={item.videoId + '-' + index}>
                <button
                  type="button"
                  className="queue-main"
                  onClick={() => {
                    onSelect(item, true, queue)
                    onClose()
                  }}
                >
                  <Artwork track={item} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{index === currentIndex ? 'Playing now' : item.artist}</small>
                  </span>
                </button>

                {index !== currentIndex && (
                  <button
                    type="button"
                    className="icon-button subtle"
                    aria-label={'Remove ' + item.title}
                    onClick={() => onRemove(item.videoId)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <ListMusic size={21} />
            <p>Your queue is empty.</p>
          </div>
        )}

        {queue.length > 1 && (
          <button type="button" className="sheet-action danger" onClick={onClear}>
            <Trash2 size={15} /> Clear queue
          </button>
        )}
      </section>
    </div>
  )
}

export default function Player({
  playback,
  onPlaybackChange,
  onSelectTrack,
  onTrackStarted,
  likedTracks,
  onToggleLike,
  onRequestPlaylist,
  onRemoveFromQueue,
  onClearQueue,
}) {
  const [expanded, setExpanded] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')
  const [volume, setVolume] = useState(80)
  const [muted, setMuted] = useState(false)
  const [seekValue, setSeekValue] = useState(null)
  const [pipPosition, setPipPosition] = useState(playback.pipPosition || null)

  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const currentVideoIdRef = useRef('')
  const currentTrackRef = useRef(playback.currentTrack)
  const queueRef = useRef(playback.queue)
  const queueIndexRef = useRef(playback.currentQueueIndex)
  const playingRef = useRef(playback.isPlaying)
  const shuffleRef = useRef(shuffle)
  const repeatRef = useRef(repeat)
  const volumeRef = useRef(volume)
  const progressTimerRef = useRef(null)
  const dragRef = useRef(null)
  const dragMovedRef = useRef(false)
  const dragCleanupRef = useRef(null)
  const nativeNotificationRequestedRef = useRef(false)

  const track = playback.currentTrack
  const isPlaying = playback.isPlaying
  const pipVisible = Boolean(playback.pipVisible)
  const isLoading = playback.isLoading
  const duration = playback.duration
  const displayedTime = seekValue ?? playback.currentTime
  const progress = duration > 0
    ? Math.min(100, Math.max(0, displayedTime / duration * 100))
    : 0
  const liked = Boolean(track && likedTracks.some((item) => item.videoId === track.videoId))

  useEffect(() => { currentTrackRef.current = track }, [track])
  useEffect(() => { queueRef.current = playback.queue }, [playback.queue])
  useEffect(() => { queueIndexRef.current = playback.currentQueueIndex }, [playback.currentQueueIndex])
  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => {
    if (!dragRef.current) setPipPosition(playback.pipPosition || null)
  }, [playback.pipPosition])

  const startPipDrag = (event) => {
    if (expanded || event.button > 0) return

    const target = event.target
    if (target.closest('button, input, textarea, a')) return

    const dock = event.currentTarget.closest('.pip-player')
    if (!dock) return

    const rect = dock.getBoundingClientRect()
    const currentX = pipPosition?.x ?? rect.left
    const currentY = pipPosition?.y ?? rect.top

    dragMovedRef.current = false
    dragRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: currentX,
      startY: currentY,
      width: rect.width,
      height: rect.height,
      position: { x: currentX, y: currentY },
    }

    const onMove = (moveEvent) => {
      const drag = dragRef.current
      if (!drag || moveEvent.pointerId !== drag.pointerId) return

      const deltaX = moveEvent.clientX - drag.startPointerX
      const deltaY = moveEvent.clientY - drag.startPointerY

      if (Math.hypot(deltaX, deltaY) > 5) {
        dragMovedRef.current = true
      }

      const maxX = Math.max(8, window.innerWidth - drag.width - 8)
      const navReserve = 84
      const maxY = Math.max(8, window.innerHeight - drag.height - navReserve)

      drag.position = {
        x: Math.min(maxX, Math.max(8, drag.startX + deltaX)),
        y: Math.min(maxY, Math.max(8, drag.startY + deltaY)),
      }

      setPipPosition(drag.position)
    }

    const onUp = (upEvent) => {
      const drag = dragRef.current
      if (!drag || upEvent.pointerId !== drag.pointerId) return

      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragCleanupRef.current = null

      if (dragMovedRef.current) {
        onPlaybackChange({ pipPosition: drag.position }, { sync: false })
      }

      dragRef.current = null
    }

    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragRef.current = null
      dragCleanupRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    progressTimerRef.current = null
  }, [])

  const readProgress = useCallback(() => {
    const player = playerRef.current
    if (!player?.getCurrentTime) return

    onPlaybackChange({
      currentTime: Number(player.getCurrentTime()) || 0,
      duration: Number(player.getDuration?.()) || 0,
    }, { sync: false })
  }, [onPlaybackChange])

  const startProgress = useCallback(() => {
    stopProgress()
    readProgress()
    progressTimerRef.current = window.setInterval(readProgress, 400)
  }, [readProgress, stopProgress])

  const nextTrack = useCallback(() => {
    const tracks = queueRef.current
    const index = queueIndexRef.current
    if (!tracks.length) return

    let nextIndex = -1

    if (shuffleRef.current && tracks.length > 1) {
      const choices = tracks.map((_, candidate) => candidate).filter((candidate) => candidate !== index)
      nextIndex = choices[Math.floor(Math.random() * choices.length)]
    } else if (index < tracks.length - 1) {
      nextIndex = index + 1
    } else if (repeatRef.current === 'all') {
      nextIndex = 0
    }

    if (nextIndex >= 0) onSelectTrack(tracks[nextIndex], true, tracks)
  }, [onSelectTrack])

  const previousTrack = useCallback(() => {
    const player = playerRef.current
    const position = Number(player?.getCurrentTime?.()) || 0

    if (position > 3) {
      player?.seekTo?.(0, true)
      onPlaybackChange({ currentTime: 0 }, {
        sync: true,
        command: 'seek',
        seekPosition: 0,
      })
      return
    }

    const tracks = queueRef.current
    if (!tracks.length) return

    let previousIndex = queueIndexRef.current - 1
    if (previousIndex < 0) {
      if (repeatRef.current !== 'all') return
      previousIndex = tracks.length - 1
    }

    if (tracks[previousIndex]) onSelectTrack(tracks[previousIndex], true, tracks)
  }, [onPlaybackChange, onSelectTrack])

  const handleEnded = useCallback(() => {
    if (repeatRef.current === 'one') {
      const player = playerRef.current
      player?.seekTo?.(0, true)
      player?.playVideo?.()
      return
    }

    nextTrack()
  }, [nextTrack])

  useEffect(() => {
    const videoId = track?.videoId || ''

    if (!videoId) {
      currentVideoIdRef.current = ''
      playerRef.current?.destroy?.()
      playerRef.current = null
      stopProgress()
      return undefined
    }

    if (playerRef.current) {
      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId
        stopProgress()
        playerRef.current.loadVideoById(videoId)
        if (playingRef.current) playerRef.current.playVideo()
      }
      return undefined
    }

    let cancelled = false

    loadYouTubeApi().then((youtube) => {
      if (cancelled || !mountRef.current || playerRef.current) return

      const videoPlayer = new youtube.Player(mountRef.current, {
        videoId,
        playerVars: {
          playsinline: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return
            playerRef.current = event.target
            currentVideoIdRef.current = videoId
            event.target.setVolume(volumeRef.current)

            if (playingRef.current) event.target.playVideo()
          },
          onStateChange: (event) => {
            if (currentVideoIdRef.current !== videoId) return

            if (event.data === youtube.PlayerState.PLAYING) {
              setMuted(Boolean(event.target.isMuted?.()))
              onPlaybackChange({ isPlaying: true, isLoading: false }, { sync: false })
              onTrackStarted?.(currentTrackRef.current)
              startProgress()
              return
            }

            if (event.data === youtube.PlayerState.BUFFERING) {
              onPlaybackChange({ isLoading: true }, { sync: false })
              return
            }

            if (event.data === youtube.PlayerState.PAUSED) {
              stopProgress()
              readProgress()
              onPlaybackChange({ isPlaying: false, isLoading: false }, { sync: false })
              return
            }

            if (event.data === youtube.PlayerState.ENDED) {
              stopProgress()
              readProgress()
              onPlaybackChange({ isPlaying: false, isLoading: false }, { sync: false })
              handleEnded()
              return
            }

            if (event.data === youtube.PlayerState.CUED) {
              stopProgress()
              onPlaybackChange({
                isPlaying: false,
                isLoading: false,
                currentTime: 0,
                duration: 0,
              }, { sync: false })
            }
          },
          onError: () => {
            stopProgress()
            onPlaybackChange({
              isPlaying: false,
              isLoading: false,
              error: 'YouTube could not play this video.',
            }, { sync: false })
          },
        },
      })

      playerRef.current = videoPlayer
    })

    return () => {
      cancelled = true
    }
  }, [
    handleEnded,
    onPlaybackChange,
    onTrackStarted,
    readProgress,
    startProgress,
    stopProgress,
    track?.videoId,
  ])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !track?.videoId || !window.YT?.PlayerState) return

    const state = player.getPlayerState?.()

    if (isPlaying) {
      if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
        player.playVideo()
      }
    } else if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING) {
      player.pauseVideo()
    }
  }, [isPlaying, track?.videoId])

  useEffect(() => {
    const request = playback.seekRequest
    if (!request?.remote || request.videoId !== track?.videoId || !Number.isFinite(request.time)) return
    playerRef.current?.seekTo?.(Math.max(0, request.time), true)
  }, [playback.seekRequest, track?.videoId])

  useEffect(() => () => {
    stopProgress()
    dragCleanupRef.current?.()
    playerRef.current?.destroy?.()
    playerRef.current = null
  }, [stopProgress])

  useEffect(() => {
    if (!expanded && !queueOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setQueueOpen(false)
        setExpanded(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded, queueOpen])

  const togglePlayback = useCallback(() => {
    const player = playerRef.current
    if (!player) return

    const nextPlaying = !playingRef.current
    const current = Number(player.getCurrentTime?.()) || playback.currentTime

    onPlaybackChange({
      isPlaying: nextPlaying,
      isLoading: nextPlaying,
      currentTime: current,
    }, {
      sync: true,
      command: 'playback',
    })
  }, [onPlaybackChange])

  const handleSeek = (event) => {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) return

    setSeekValue(next)
    playerRef.current?.seekTo?.(next, true)
    onPlaybackChange({ currentTime: next }, { sync: false })
  }

  const commitSeek = () => {
    if (seekValue == null) return
    const next = seekValue
    setSeekValue(null)
    onPlaybackChange({ currentTime: next }, {
      sync: true,
      command: 'seek',
      seekPosition: next,
    })
  }

  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return

    if (muted) {
      const next = volumeRef.current || 80
      setMuted(false)
      setVolume(next)
      player.unMute()
      player.setVolume(next)
    } else {
      volumeRef.current = volume || 80
      setMuted(true)
      player.mute()
    }
  }

  const changeVolume = (event) => {
    const next = Number(event.target.value)
    setVolume(next)
    volumeRef.current = next
    setMuted(next === 0)
    playerRef.current?.setVolume?.(next)
  }

  const cycleRepeat = () => {
    setRepeat((current) => current === 'off' ? 'all' : current === 'all' ? 'one' : 'off')
  }

  useEffect(() => {
    if (!track) {
      stopNativeMedia()
      return
    }

    if (isPlaying) {
      if (!nativeNotificationRequestedRef.current) {
        nativeNotificationRequestedRef.current = true
        requestNativeMediaPermission()
      }
      startNativeMedia(track)
    } else {
      stopNativeMedia()
    }
  }, [isPlaying, track])

  useEffect(() => {
    const handleNativeCommand = (event) => {
      const command = event.detail?.command

      if (command === 'play' && !playingRef.current) {
        togglePlayback()
      } else if (command === 'pause' && playingRef.current) {
        togglePlayback()
      } else if (command === 'previous') {
        previousTrack()
      } else if (command === 'next') {
        nextTrack()
      }
    }

    window.addEventListener('krovi-native-media-command', handleNativeCommand)
    return () => window.removeEventListener('krovi-native-media-command', handleNativeCommand)
  }, [nextTrack, previousTrack, togglePlayback])

  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return undefined

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Krovi Music',
        artwork: track.thumbnail
          ? [{ src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' }]
          : [],
      })

      const setHandler = (action, handler) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler)
        } catch {
          // Some actions are not supported on every Android/WebView build.
        }
      }

      setHandler('play', () => {
        if (!playingRef.current) togglePlayback()
      })
      setHandler('pause', () => {
        if (playingRef.current) togglePlayback()
      })
      setHandler('previoustrack', previousTrack)
      setHandler('nexttrack', nextTrack)
    } catch {
      // MediaSession is an optional enhancement.
    }

    return () => {
      try {
        navigator.mediaSession.metadata = null
      } catch {
        // Ignore teardown differences across WebView versions.
      }
    }
  }, [nextTrack, previousTrack, togglePlayback, track])

  useEffect(() => {
    const resumeVisiblePlayback = () => {
      if (document.visibilityState !== 'visible' || !playingRef.current) return
      playerRef.current?.playVideo?.()
    }

    document.addEventListener('visibilitychange', resumeVisiblePlayback)
    return () => document.removeEventListener('visibilitychange', resumeVisiblePlayback)
  }, [])

  if (!track) return null

  return (
    <>
      {expanded && <div className="player-backdrop" aria-hidden="true" />}

      <div
        className={'pip-player ' + (expanded ? 'is-expanded' : '') + (!pipVisible ? ' is-hidden' : '')}
          style={!expanded && pipPosition ? {
            left: pipPosition.x + 'px',
            top: pipPosition.y + 'px',
            right: 'auto',
            bottom: 'auto',
          } : undefined}
        >
          {expanded && (
            <header className="player-full-header">
              <button type="button" className="icon-button" aria-label="Close full video" onClick={() => setExpanded(false)}>
                <ChevronDown size={22} />
              </button>
              <p className="eyebrow">NOW PLAYING</p>
              <button type="button" className="icon-button" aria-label="Open queue" onClick={() => setQueueOpen(true)}>
                <ListMusic size={19} />
              </button>
            </header>
          )}

          <div className="player-video">
            <div className="youtube-mount" ref={mountRef} />
            <div className="player-video-grain" aria-hidden="true" />

            {!expanded && (
              <>
                <button
                  type="button"
                  className="pip-drag-handle"
                  aria-label="Hold and drag video"
                  onPointerDown={startPipDrag}
                >
                  <Move size={16} />
                </button>
                <button
                  type="button"
                  className="pip-close-button"
                  aria-label="Hide video"
                  onClick={() => onPlaybackChange({ pipVisible: false }, { sync: false })}
                >
                  <X size={16} />
                </button>
              </>
            )}

            <button
              type="button"
              className="pip-full-button"
              aria-label="Watch video full screen"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {expanded && (
            <div className="player-expanded-content">
              <section className="player-full-info">
                <Artwork track={track} large />
                <div className="player-full-copy">
                  <h1>{track.title}</h1>
                  <p>{track.artist}</p>
                </div>
                <button
                  type="button"
                  className={'icon-button ' + (liked ? 'active' : '')}
                  aria-label={liked ? 'Unlike' : 'Like'}
                  onClick={() => onToggleLike(track)}
                >
                  <Heart size={21} fill={liked ? 'currentColor' : 'none'} />
                </button>
              </section>

              <div className="progress-area">
                <input
                  className="player-range"
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={duration ? displayedTime : 0}
                  style={{ '--range-progress': progress + '%' }}
                  onChange={handleSeek}
                  onPointerUp={commitSeek}
                  onKeyUp={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) commitSeek()
                  }}
                  aria-label="Seek through track"
                />
                <div className="time-row">
                  <span>{formatTime(displayedTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="player-controls">
                <button type="button" className="control-button secondary" aria-label="Previous track" onClick={previousTrack}>
                  <SkipBack size={18} fill="currentColor" />
                </button>
                <button type="button" className="control-button primary" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback}>
                  {isLoading
                    ? <LoaderCircle size={22} className="spin" />
                    : isPlaying
                      ? <Pause size={22} fill="currentColor" />
                      : <Play size={22} fill="currentColor" />}
                </button>
                <button type="button" className="control-button secondary" aria-label="Next track" onClick={nextTrack}>
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>

              <div className="full-secondary-controls">
                <button type="button" className={'control-pill ' + (shuffle ? 'active' : '')} onClick={() => setShuffle((current) => !current)}>
                  <Shuffle size={16} /> Shuffle
                </button>
                <button type="button" className={'control-pill ' + (repeat !== 'off' ? 'active' : '')} onClick={cycleRepeat}>
                  {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat2 size={16} />} Repeat
                </button>
                <button type="button" className="control-pill" onClick={() => setQueueOpen(true)}>
                  <ListMusic size={16} /> Queue
                </button>
                <button type="button" className="control-pill" onClick={() => onRequestPlaylist(track)}>
                  <Plus size={16} /> Playlist
                </button>
              </div>

              <div className="volume-row">
                <button type="button" className="icon-button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  className="player-range volume-range"
                  type="range"
                  min="0"
                  max="100"
                  value={muted ? 0 : volume}
                  style={{ '--range-progress': (muted ? 0 : volume) + '%' }}
                  onChange={changeVolume}
                  aria-label="Volume"
                />
                <button type="button" className="icon-button subtle" aria-label="Close full video" onClick={() => setExpanded(false)}>
                  <Maximize2 size={17} />
                </button>
              </div>
            </div>
          )}
      </div>

      <aside className={'player-dock ' + (isPlaying ? 'is-playing' : '')}>
        <div className="player-dock-body">
          <button type="button" className="player-track-button" onClick={() => {
            if (pipVisible) setExpanded(true)
            else onPlaybackChange({ pipVisible: true }, { sync: false })
          }} aria-label={pipVisible ? 'Open full player' : 'Show video player'}>
            <Artwork track={track} />
            <span className="player-track-copy">
              <strong>{track.title}</strong>
              <small>{track.artist}</small>
            </span>
          </button>

          <div className="player-dock-actions">
            <button type="button" className={'icon-button ' + (liked ? 'active' : '')} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => onToggleLike(track)}>
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-button" aria-label="Open queue" onClick={() => setQueueOpen(true)}>
              <ListMusic size={18} />
            </button>
            {!pipVisible && (
              <button
                type="button"
                className="icon-button"
                aria-label="Show video player"
                onClick={() => onPlaybackChange({ pipVisible: true }, { sync: false })}
              >
                <Maximize2 size={18} />
              </button>
            )}
            <button type="button" className="mini-play" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback}>
              {isLoading ? <LoaderCircle size={17} className="spin" /> : isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
          </div>
        </div>

        <div className="mini-progress" aria-hidden="true"><span style={{ width: progress + '%' }} /></div>
      </aside>

      {queueOpen && (
        <QueueDrawer
          queue={playback.queue}
          currentIndex={playback.currentQueueIndex}
          onSelect={onSelectTrack}
          onRemove={onRemoveFromQueue}
          onClear={onClearQueue}
          onClose={() => setQueueOpen(false)}
        />
      )}
    </>
  )
}
