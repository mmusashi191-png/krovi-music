import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Heart,
  ListMusic,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
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

let youtubeApiPromise

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      const previousReady = window.onYouTubeIframeAPIReady

      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        resolve(window.YT)
      }

      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.async = true
        document.head.appendChild(script)
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
      <section className="queue-drawer" role="dialog" aria-modal="true" aria-label="Playback queue" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">UP NEXT</p>
            <h2>Queue</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close queue" onClick={onClose}><X size={19} /></button>
        </header>

        {queue.length ? (
          <div className="queue-list">
            {queue.map((track, index) => (
              <div className={'queue-row ' + (index === currentIndex ? 'current' : '')} key={track.videoId + '-' + index}>
                <button
                  type="button"
                  className="queue-main"
                  onClick={() => {
                    onSelect(track, true, queue)
                    onClose()
                  }}
                >
                  <Artwork track={track} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{index === currentIndex ? 'Playing now' : track.artist}</small>
                  </span>
                </button>
                {index !== currentIndex && (
                  <button
                    type="button"
                    className="icon-button subtle"
                    aria-label={'Remove ' + track.title}
                    onClick={() => onRemove(track.videoId)}
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

        <button type="button" className="sheet-action danger" onClick={onClear}>
          <Trash2 size={15} /> Clear queue
        </button>
      </section>
    </div>
  )
}

function PlayerControls({ isPlaying, isLoading, onToggle, onPrevious, onNext }) {
  return (
    <div className="player-controls">
      <button type="button" className="control-button secondary" aria-label="Previous track" onClick={onPrevious}><SkipBack size={18} fill="currentColor" /></button>
      <button type="button" className="control-button primary" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={onToggle}>
        {isLoading ? <LoaderCircle size={21} className="spin" /> : isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>
      <button type="button" className="control-button secondary" aria-label="Next track" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
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

  const track = playback.currentTrack
  const isPlaying = playback.isPlaying
  const isLoading = playback.isLoading
  const duration = playback.duration
  const currentTime = seekValue ?? playback.currentTime
  const progress = duration > 0 ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0
  const liked = Boolean(track && likedTracks.some((item) => item.videoId === track.videoId))

  useEffect(() => { currentTrackRef.current = track }, [track])
  useEffect(() => { queueRef.current = playback.queue }, [playback.queue])
  useEffect(() => { queueIndexRef.current = playback.currentQueueIndex }, [playback.currentQueueIndex])
  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { volumeRef.current = volume }, [volume])

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

  const playNext = useCallback(() => {
    const tracks = queueRef.current
    const index = queueIndexRef.current
    if (!tracks.length) return

    let nextIndex = -1
    if (shuffleRef.current && tracks.length > 1) {
      const candidates = tracks.map((_, candidate) => candidate).filter((candidate) => candidate !== index)
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)]
    } else if (index < tracks.length - 1) {
      nextIndex = index + 1
    } else if (repeatRef.current === 'all') {
      nextIndex = 0
    }

    if (nextIndex >= 0) onSelectTrack(tracks[nextIndex], true, tracks)
  }, [onSelectTrack])

  const playPrevious = useCallback(() => {
    const player = playerRef.current
    const position = Number(player?.getCurrentTime?.()) || 0

    if (position > 3) {
      player.seekTo(0, true)
      onPlaybackChange({ currentTime: 0 }, { sync: true, command: 'seek', seekPosition: 0 })
      return
    }

    const tracks = queueRef.current
    let index = queueIndexRef.current - 1
    if (index < 0) {
      if (repeatRef.current !== 'all') return
      index = tracks.length - 1
    }
    if (tracks[index]) onSelectTrack(tracks[index], true, tracks)
  }, [onPlaybackChange, onSelectTrack])

  const handleEnded = useCallback(() => {
    if (repeatRef.current === 'one') {
      const player = playerRef.current
      if (player) {
        player.seekTo(0, true)
        player.playVideo()
      }
      return
    }
    playNext()
  }, [playNext])

  useEffect(() => {
    const videoId = track?.videoId || ''

    if (!videoId) {
      currentVideoIdRef.current = ''
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
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
          controls: 1,
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
            setMuted(Boolean(event.target.isMuted?.()))
            if (playingRef.current) event.target.playVideo()
          },
          onStateChange: (event) => {
            if (currentVideoIdRef.current !== videoId) return

            if (event.data === youtube.PlayerState.PLAYING) {
              onPlaybackChange({ isPlaying: true, isLoading: false }, { sync: false })
              onTrackStarted?.(currentTrackRef.current)
              startProgress()
            } else if (event.data === youtube.PlayerState.BUFFERING) {
              onPlaybackChange({ isLoading: true }, { sync: false })
            } else if (event.data === youtube.PlayerState.PAUSED) {
              stopProgress()
              readProgress()
              onPlaybackChange({ isPlaying: false, isLoading: false }, { sync: false })
            } else if (event.data === youtube.PlayerState.ENDED) {
              stopProgress()
              readProgress()
              onPlaybackChange({ isPlaying: false, isLoading: false }, { sync: false })
              handleEnded()
            } else if (event.data === youtube.PlayerState.CUED) {
              stopProgress()
              onPlaybackChange({ isPlaying: false, isLoading: false, currentTime: 0, duration: 0 }, { sync: false })
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
  }, [handleEnded, onPlaybackChange, onTrackStarted, readProgress, startProgress, stopProgress, track?.videoId])

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
    const player = playerRef.current
    if (!request?.remote || request.videoId !== track?.videoId || !Number.isFinite(request.time)) return

    player?.seekTo?.(Math.max(0, request.time), true)
  }, [playback.seekRequest, track?.videoId])

  useEffect(() => () => {
    stopProgress()
    playerRef.current?.destroy()
    playerRef.current = null
  }, [stopProgress])

  useEffect(() => {
    if (!expanded && !queueOpen) return undefined
    const handler = (event) => {
      if (event.key !== 'Escape') return
      setQueueOpen(false)
      setExpanded(false)
    }
    window.addEventListener('keydown', handler)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handler)
    }
  }, [expanded, queueOpen])

  if (!track) return null

  const togglePlayback = () => {
    const player = playerRef.current
    if (!player) return
    const current = Number(player.getCurrentTime?.()) || 0
    const nextPlaying = !playingRef.current
    onPlaybackChange({
      isPlaying: nextPlaying,
      isLoading: nextPlaying,
      currentTime: current,
    }, {
      sync: true,
      command: 'playback',
    })
  }

  const changeSeek = (event) => {
    const next = Number(event.target.value)
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

  const changeVolume = (event) => {
    const next = Number(event.target.value)
    setVolume(next)
    setMuted(next === 0)
    playerRef.current?.setVolume?.(next)
    if (next > 0) volumeRef.current = next
  }

  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return
    if (muted) {
      const next = volumeRef.current || 80
      setVolume(next)
      setMuted(false)
      player.unMute()
      player.setVolume(next)
    } else {
      if (volume > 0) volumeRef.current = volume
      setMuted(true)
      player.mute()
    }
  }

  const toggleRepeat = () => {
    setRepeat((current) => current === 'off' ? 'all' : current === 'all' ? 'one' : 'off')
  }

  return (
    <>
      <aside className={'player-dock ' + (expanded ? 'expanded-hidden' : '')}>
        <div className="player-video-mini">
          <div className="youtube-mount" ref={mountRef} />
          <div className="player-mini-sheen" aria-hidden="true" />
        </div>

        <div className="player-dock-body">
          <button type="button" className="player-track-button" onClick={() => setExpanded(true)} aria-label="Open full player">
            <Artwork track={track} />
            <span className="player-track-copy">
              <strong>{track.title}</strong>
              <small>{track.artist}</small>
            </span>
          </button>

          <div className="player-dock-actions">
            <button type="button" className={liked ? 'icon-button active' : 'icon-button'} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => onToggleLike(track)}>
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-button" aria-label="Open queue" onClick={() => setQueueOpen(true)}>
              <ListMusic size={18} />
            </button>
            <button type="button" className="mini-play" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback}>
              {isLoading ? <LoaderCircle size={17} className="spin" /> : isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
          </div>
        </div>

        <div className="mini-progress" aria-hidden="true"><span style={{ width: progress + '%' }} /></div>
      </aside>

      {expanded && (
        <div className="player-fullscreen">
          <div className="player-fullscreen-inner">
            <header className="player-full-header">
              <button type="button" className="icon-button" aria-label="Close player" onClick={() => setExpanded(false)}><ChevronDown size={22} /></button>
              <span className="eyebrow">NOW PLAYING</span>
              <button type="button" className="icon-button" aria-label="Open queue" onClick={() => setQueueOpen(true)}><ListMusic size={19} /></button>
            </header>

            <div className="player-full-video">
              <div className="youtube-mount" ref={expanded ? undefined : null} />
              <div className="player-full-overlay" aria-hidden="true" />
            </div>

            <section className="player-full-info">
              <div className="player-full-art"><Artwork track={track} large /></div>
              <div className="player-full-copy">
                <h1>{track.title}</h1>
                <p>{track.artist}</p>
              </div>
              <button type="button" className={liked ? 'icon-button active' : 'icon-button'} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => onToggleLike(track)}>
                <Heart size={21} fill={liked ? 'currentColor' : 'none'} />
              </button>
            </section>

            <div className="progress-area">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={duration ? currentTime : 0}
                onChange={changeSeek}
                onPointerUp={commitSeek}
                onKeyUp={(event) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) commitSeek()
                }}
                aria-label="Seek through track"
              />
              <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            </div>

            <PlayerControls isPlaying={isPlaying} isLoading={isLoading} onToggle={togglePlayback} onPrevious={playPrevious} onNext={playNext} />

            <div className="full-secondary-controls">
              <button type="button" className={'control-pill ' + (shuffle ? 'active' : '')} onClick={() => setShuffle((current) => !current)}><Shuffle size={16} /> Shuffle</button>
              <button type="button" className={'control-pill ' + (repeat !== 'off' ? 'active' : '')} onClick={toggleRepeat}>
                {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat2 size={16} />}
                Repeat
              </button>
              <button type="button" className="control-pill" onClick={() => setQueueOpen(true)}><ListMusic size={16} /> Queue</button>
              <button type="button" className="control-pill" onClick={() => onRequestPlaylist(track)}><PlusIcon /> Playlist</button>
            </div>

            <div className="volume-row">
              <button type="button" className="icon-button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input type="range" min="0" max="100" value={muted ? 0 : volume} onChange={changeVolume} aria-label="Volume" />
              <button type="button" className="icon-button subtle" aria-label="Close expanded player" onClick={() => setExpanded(false)}><Maximize2 size={17} /></button>
            </div>
          </div>
        </div>
      )}

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

function PlusIcon() {
  return <span className="plus-mark" aria-hidden="true">+</span>
}
