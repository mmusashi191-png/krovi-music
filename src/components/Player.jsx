import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown, Heart, ListMusic, LoaderCircle, Maximize2, Pause, Play, Repeat2,
  Shuffle, SkipBack, SkipForward, Trash2, Volume2, VolumeX, X,
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
        document.head.appendChild(script)
      }
    })
  }
  return youtubeApiPromise
}

function formatTime(value) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function PlayerArtwork({ track, large = false }) {
  return <div className={`player-art ${track.tone || 'blue'} ${large ? 'large' : ''}`}>{track.thumbnail ? <img src={track.thumbnail} alt={`Thumbnail for ${track.title}`} /> : <span>{track.initials || 'YT'}</span>}<i /><b /></div>
}

function QueueDrawer({ queue, currentQueueIndex, onSelectTrack, onRemoveFromQueue, onClearQueue, onClose }) {
  return <div className="queue-drawer-backdrop" role="presentation" onClick={onClose}><section className="queue-drawer" role="dialog" aria-modal="true" aria-label="Playback queue" onClick={(event) => event.stopPropagation()}><header className="queue-drawer-header"><div><p className="expanded-eyebrow">UP NEXT</p><h2>Your queue</h2></div><button type="button" className="expanded-close" aria-label="Close queue" onClick={onClose}><X size={20} /></button></header>{queue.length ? <div className="queue-drawer-list">{queue.map((track, index) => <div className={`queue-drawer-row ${index === currentQueueIndex ? 'is-current' : ''}`} key={`${track.videoId}-${index}`}><button type="button" className="queue-song-main" onClick={() => { onSelectTrack(track, true, queue); onClose() }}><PlayerArtwork track={track} /><span><strong>{track.title}</strong><small>{index === currentQueueIndex ? 'Now playing' : track.artist}</small></span></button>{index !== currentQueueIndex && <button type="button" className="queue-remove" aria-label={`Remove ${track.title} from queue`} onClick={() => onRemoveFromQueue(track.videoId)}><Trash2 size={16} /></button>}</div>)}</div> : <p className="queue-empty">Your queue is clear.</p>}<button type="button" className="queue-clear" onClick={onClearQueue}>Clear queue</button></section></div>
}

function Player({ playback, currentTrack, queue, currentQueueIndex, playRequest, onPlaybackChange, onSelectTrack, onTrackStarted, likedTracks, onToggleLike, onRequestPlaylist, onRemoveFromQueue, onClearQueue }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState('OFF')
  const playerContainerRef = useRef(null)
  const youtubePlayerRef = useRef(null)
  const seekTokenRef = useRef(0)
  const progressTimerRef = useRef(null)
  const currentVideoIdRef = useRef('')
  const currentTrackRef = useRef(currentTrack)
  const queueRef = useRef(queue)
  const queueIndexRef = useRef(currentQueueIndex)
  const shuffleRef = useRef(shuffle)
  const repeatModeRef = useRef(repeatMode)
  const playRequestRef = useRef(playRequest)
  const volumeBeforeMuteRef = useRef(volume)
  const volumeRef = useRef(volume)
  const miniPlayerDragRef = useRef(null)
  const miniPlayerPanelRef = useRef(null)
  const { isPlaying, currentTime, duration, pipVisible, pipPosition, seekRequest, isLoading: isBuffering } = playback
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
const localSeekRef = useRef(null)
const isSeekingRef = useRef(false)
  useEffect(() => {
    if (!isExpanded && !isQueueOpen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') { setIsQueueOpen(false); if (isExpanded) setIsExpanded(false) } }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [isExpanded, isQueueOpen])
  const videoId = currentTrack?.videoId || ''
  const hasVideoId = Boolean(videoId)

  useEffect(() => { currentTrackRef.current = currentTrack }, [currentTrack])
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { queueIndexRef.current = currentQueueIndex }, [currentQueueIndex])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { repeatModeRef.current = repeatMode }, [repeatMode])
  useEffect(() => { playRequestRef.current = playRequest }, [playRequest])
  useEffect(() => { volumeRef.current = volume }, [volume])

  useEffect(() => {
    const clampMiniPlayer = () => onPlaybackChange({ pipPosition: playback.pipPosition && (() => {
      const position = playback.pipPosition
      if (!position) return position
      const panel = miniPlayerPanelRef.current
      const width = panel?.getBoundingClientRect().width || Math.min(340, window.innerWidth - 24)
      const height = panel?.getBoundingClientRect().height || 150
      return { left: Math.max(12, Math.min(position.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(position.top, window.innerHeight - height - 12)) }
    })() })
    window.addEventListener('resize', clampMiniPlayer)
    return () => window.removeEventListener('resize', clampMiniPlayer)
  }, [onPlaybackChange, playback.pipPosition])

  useEffect(() => () => {
    const drag = miniPlayerDragRef.current
    if (drag && miniPlayerPanelRef.current?.hasPointerCapture?.(drag.pointerId)) miniPlayerPanelRef.current.releasePointerCapture(drag.pointerId)
    miniPlayerDragRef.current = null
  }, [])

  const stopProgressPolling = useCallback(() => {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    progressTimerRef.current = null
  }, [])

  const updateProgress = useCallback(() => {
  const player = youtubePlayerRef.current
  if (!player?.getCurrentTime || !player.getDuration) return

  const nextCurrentTime = Number(player.getCurrentTime()) || 0
  const nextDuration = Number(player.getDuration()) || 0

  onPlaybackChange(
    {
      currentTime: nextCurrentTime,
      duration: nextDuration,
    },
    { sync: false }
  )
}, [onPlaybackChange])

  const startProgressPolling = useCallback(() => {
    stopProgressPolling()
    updateProgress()
    progressTimerRef.current = window.setInterval(updateProgress, 250)
  }, [stopProgressPolling, updateProgress])

  const playTrack = useCallback((track, options = {}) => {
    if (!track?.videoId) return
    const trackQueue = options.queue || queueRef.current
    const nextIndex = trackQueue.findIndex((candidate) => candidate.videoId === track.videoId)
    onSelectTrack(track, Boolean(options.autoplay), trackQueue)
    queueRef.current = trackQueue
    queueIndexRef.current = nextIndex
    currentTrackRef.current = track
    currentVideoIdRef.current = track.videoId
    onPlaybackChange(
      {
        isPlaying: Boolean(options.autoplay),
        isLoading: Boolean(options.autoplay),
        currentTime: 0,
        duration: 0,
        error: '',
      },
      { sync: true }
    )
    stopProgressPolling()
  }, [onPlaybackChange, onSelectTrack, stopProgressPolling])

  const nextTrack = useCallback(() => {
    const tracks = queueRef.current
    const index = queueIndexRef.current
    if (!tracks.length) return
    let nextIndex
    if (shuffleRef.current && tracks.length > 1) {
      const choices = tracks.map((_, candidateIndex) => candidateIndex).filter((candidateIndex) => candidateIndex !== index)
      nextIndex = choices[Math.floor(Math.random() * choices.length)]
    } else if (index < tracks.length - 1) {
      nextIndex = index + 1
    } else if (repeatModeRef.current === 'ALL') {
      nextIndex = 0
    } else {
      return
    }
    playTrack(tracks[nextIndex], { autoplay: true, queue: tracks })
  }, [playTrack])

  const previousTrack = useCallback(() => {
    const player = youtubePlayerRef.current
    const time = Number(player?.getCurrentTime?.()) || 0
    if (time > 3) {
      player.seekTo(0, true)
      onPlaybackChange({ currentTime: 0 })
      return
    }
    const tracks = queueRef.current
    const index = queueIndexRef.current
    if (!tracks.length) return
    let previousIndex = index - 1
    if (previousIndex < 0) {
      if (repeatModeRef.current !== 'ALL') return
      previousIndex = tracks.length - 1
    }
    playTrack(tracks[previousIndex], { autoplay: true, queue: tracks })
  }, [onPlaybackChange, playTrack])

  const handleEnded = useCallback(() => {
    if (repeatModeRef.current === 'ONE') {
      const player = youtubePlayerRef.current
      const track = currentTrackRef.current
      if (player && track?.videoId) {
        player.loadVideoById(track.videoId)
        player.playVideo()
      }
      return
    }
    nextTrack()
  }, [nextTrack])

  useEffect(() => {
    if (!hasVideoId || youtubePlayerRef.current || !playerContainerRef.current) return undefined

    let cancelled = false
    const trackVideoId = videoId

    loadYouTubeApi().then((youtube) => {
      if (cancelled || youtubePlayerRef.current || !playerContainerRef.current) return

      const player = new youtube.Player(playerContainerRef.current, {
        videoId: trackVideoId,
        playerVars: {
          playsinline: 1,
          controls: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled || currentVideoIdRef.current !== trackVideoId) return

            player.setVolume(volumeRef.current ?? 80)
            setVolume(player.getVolume?.() || volumeRef.current || 80)
            setIsMuted(Boolean(player.isMuted?.()))

            const request = playRequestRef.current

            if (
  request?.videoId === trackVideoId &&
  request.autoplay !== false
) {
  player.playVideo()
}
          },

          onStateChange: (event) => {
            if (currentVideoIdRef.current !== trackVideoId) return

            if (event.data === youtube.PlayerState.PLAYING) {
              onPlaybackChange(
                { isPlaying: true, isLoading: false },
                { sync: false }
              )
              onTrackStarted?.(currentTrackRef.current)
              startProgressPolling()
            }

            else if (event.data === youtube.PlayerState.BUFFERING) {
              onPlaybackChange(
                { isLoading: true },
                { sync: false }
              )
              stopProgressPolling()
            }

            else if (event.data === youtube.PlayerState.PAUSED) {
              onPlaybackChange(
                { isPlaying: false, isLoading: false },
                { sync: false }
              )
              stopProgressPolling()
              updateProgress()
            }

            else if (event.data === youtube.PlayerState.ENDED) {
              onPlaybackChange(
                { isPlaying: false, isLoading: false },
                { sync: false }
              )
              stopProgressPolling()
              updateProgress()
              handleEnded()
            }

            else if (event.data === youtube.PlayerState.CUED) {
              onPlaybackChange(
                { isPlaying: false, isLoading: false },
                { sync: false }
              )
              stopProgressPolling()
              onPlaybackChange(
                { currentTime: 0, duration: 0 },
                { sync: false }
              )
            }
          },

          onError: () => {
            if (currentVideoIdRef.current !== trackVideoId) return

            stopProgressPolling()

            onPlaybackChange(
              {
                isPlaying: false,
                isLoading: false,
                error: 'YouTube could not play this video.',
              },
              { sync: false }
            )
          },
        },
      })

      youtubePlayerRef.current = player
      currentVideoIdRef.current = trackVideoId
    })

    return () => {
      cancelled = true
    }
  }, [
    hasVideoId,
    videoId,
    onPlaybackChange,
    onTrackStarted,
    handleEnded,
    startProgressPolling,
    stopProgressPolling,
    updateProgress,
  ])

  useEffect(() => {
    const player = youtubePlayerRef.current
    if (!videoId || !player || currentVideoIdRef.current === videoId) return
    currentVideoIdRef.current = videoId
    onPlaybackChange({ isPlaying: false, isLoading: false, currentTime: 0, duration: 0, error: '' })
    stopProgressPolling()
    player.loadVideoById(videoId)
    if (
  playRequest?.videoId === videoId &&
  playRequest?.autoplay !== false
) {
  player.playVideo()
}
  }, [onPlaybackChange, playRequest?.videoId, stopProgressPolling, videoId])

  useEffect(() => {
    const player = youtubePlayerRef.current

    if (!player || !videoId || !window.YT?.PlayerState) {
      return
    }

    const playerState = player.getPlayerState?.()

    if (isPlaying) {
      if (
        playerState !== window.YT.PlayerState.PLAYING &&
        playerState !== window.YT.PlayerState.BUFFERING
      ) {
        player.playVideo()
      }
    } else if (playerState === window.YT.PlayerState.PLAYING) {
      player.pauseVideo()
    }
  }, [isPlaying, videoId])

  useEffect(() => {
    const request = seekRequest
    const player = youtubePlayerRef.current
    if (!request?.remote || request.videoId !== videoId || !Number.isFinite(request.time) || !player?.seekTo) return
    player.seekTo(request.time, true)
  }, [seekRequest, videoId])

  useEffect(() => () => {
    stopProgressPolling()
    youtubePlayerRef.current?.destroy()
    youtubePlayerRef.current = null
  }, [stopProgressPolling])

  const handleTogglePlay = () => {
    const player = youtubePlayerRef.current
    if (!player || !window.YT) return

    const state = player.getPlayerState()

    if (state === window.YT.PlayerState.PLAYING) {
      const time = Number(player.getCurrentTime?.()) || 0

      onPlaybackChange(
        {
          isPlaying: false,
          currentTime: time,
          isLoading: false,
        },
        { sync: true }
      )

      player.pauseVideo()
    } else {
      const time = Number(player.getCurrentTime?.()) || 0

      onPlaybackChange(
        {
          isPlaying: true,
          currentTime: time,
          isLoading: true,
        },
        { sync: true }
      )

      player.playVideo()
    }
  }

  const handleSeek = (event) => {
  const nextProgress = Number(event.target.value)

  if (!Number.isFinite(nextProgress) || !Number.isFinite(duration) || duration <= 0) {
    return
  }

  const targetTime = Math.max(
    0,
    Math.min(duration, (nextProgress / 100) * duration)
  )

  const player = youtubePlayerRef.current

  isSeekingRef.current = true
  localSeekRef.current = targetTime

  /*
   * Update our own UI immediately.
   * DO NOT sync the room on every slider movement.
   */
  onPlaybackChange(
    {
      currentTime: targetTime,
      seekRequest: null,
    },
    { sync: false }
  )

  if (player?.seekTo) {
    /*
     * false while dragging = don't repeatedly request new
     * video data for every tiny slider movement.
     */
    player.seekTo(targetTime, false)
  }
}

const commitSeek = () => {
  if (!isSeekingRef.current) return

  const targetTime = localSeekRef.current

  isSeekingRef.current = false
  localSeekRef.current = null

  if (!Number.isFinite(targetTime)) return

  const player = youtubePlayerRef.current

  const playerState = player?.getPlayerState?.()
  const playingState = window.YT?.PlayerState?.PLAYING

  const wasPlaying =
    playerState === playingState ||
    playbackRef.current?.isPlaying === true

  seekTokenRef.current += 1

  /*
   * First tell the local YouTube player to seek to the final
   * position. Because the user was already playing, YouTube
   * will continue playing from this position.
   */
  if (player?.seekTo) {
    player.seekTo(targetTime, true)
  }

  /*
   * Then publish ONE authoritative seek to the room.
   * We deliberately do not publish intermediate slider movement.
   */
  onPlaybackChange(
    {
      currentTime: targetTime,
      isPlaying: wasPlaying,
      isLoading: false,
      seekRequest: {
        videoId,
        time: targetTime,
        token: `${Date.now()}-${seekTokenRef.current}`,
      },
    },
    { sync: true }
  )
}

  const handleVolume = (event) => {
    const nextVolume = Math.max(0, Math.min(100, Number(event.target.value) || 0))
    setVolume(nextVolume)
    volumeBeforeMuteRef.current = nextVolume || volumeBeforeMuteRef.current
    youtubePlayerRef.current?.setVolume(nextVolume)
    if (nextVolume > 0 && youtubePlayerRef.current?.isMuted?.()) youtubePlayerRef.current.unMute()
    setIsMuted(nextVolume === 0)
  }

  const handleMute = () => {
    const player = youtubePlayerRef.current
    if (!player) return
    if (player.isMuted()) {
      player.unMute()
      const restoredVolume = volumeBeforeMuteRef.current || 80
      player.setVolume(restoredVolume)
      setVolume(restoredVolume)
      setIsMuted(false)
    } else {
      volumeBeforeMuteRef.current = volume || 80
      player.mute()
      setIsMuted(true)
    }
  }

  const handleMiniPlayerPointerDown = (event) => {
    if (event.target.closest('button, a, input')) return
    const panel = miniPlayerPanelRef.current || event.currentTarget
    const rect = panel.getBoundingClientRect()
    panel.setPointerCapture?.(event.pointerId)
    miniPlayerDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, dragging: false }
  }

  const handleMiniPlayerPointerMove = (event) => {
    const drag = miniPlayerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.dragging) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return
      drag.dragging = true
    }
    event.preventDefault()
    const panel = miniPlayerPanelRef.current || event.currentTarget
    const { width, height } = panel.getBoundingClientRect()
    onPlaybackChange({ pipPosition: { left: Math.max(12, Math.min(event.clientX - drag.offsetX, window.innerWidth - width - 12)), top: Math.max(12, Math.min(event.clientY - drag.offsetY, window.innerHeight - height - 12)) } })
  }

  const handleMiniPlayerPointerUp = (event) => {
    const drag = miniPlayerDragRef.current
    if (drag?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (!drag.dragging) handleTogglePlay()
    miniPlayerDragRef.current = null
  }

  const handleMiniPlayerPointerCancel = (event) => {
    if (miniPlayerDragRef.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    miniPlayerDragRef.current = null
  }

  const handleMiniPlayerLostPointerCapture = (event) => {
    if (miniPlayerDragRef.current?.pointerId === event.pointerId) miniPlayerDragRef.current = null
  }

  const cycleRepeat = () => setRepeatMode((mode) => mode === 'OFF' ? 'ONE' : mode === 'ONE' ? 'ALL' : 'OFF')
  const hasPrevious = currentQueueIndex > 0 || repeatMode === 'ALL'
  const hasNext = queue.length > 0 && (currentQueueIndex < queue.length - 1 || repeatMode === 'ALL' || (shuffle && queue.length > 1))
  const isLiked = likedTracks?.some((track) => track.videoId === currentTrack?.videoId)
  const playIcon = isBuffering ? <LoaderCircle className="player-spinner" size={17} /> : isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />
  const expandedPlayIcon = isBuffering ? <LoaderCircle className="player-spinner" size={25} /> : isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />

  if (!currentTrack) return null
  const secondaryControls = <>
    <button type="button" className={`player-icon-button ${shuffle ? 'active' : ''}`} aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'} title="Shuffle" onClick={() => setShuffle((enabled) => !enabled)}><Shuffle size={16} /></button>
    <button type="button" className="player-icon-button player-skip" aria-label="Previous song" title="Previous" disabled={!hasPrevious} onClick={previousTrack}><SkipBack size={17} fill="currentColor" /></button>
    <button type="button" className="player-icon-button player-skip" aria-label="Next song" title="Next" disabled={!hasNext} onClick={nextTrack}><SkipForward size={17} fill="currentColor" /></button>
    <button type="button" className={`player-icon-button ${repeatMode !== 'OFF' ? 'active' : ''}`} aria-label={`Repeat ${repeatMode.toLowerCase()}`} title={`Repeat ${repeatMode.toLowerCase()}`} onClick={cycleRepeat}><Repeat2 size={17} /><small className={repeatMode === 'ONE' ? 'repeat-one' : ''}>{repeatMode === 'ONE' ? '1' : ''}</small></button>
  </>
  const likeButton = <><button type="button" className={`player-icon-button heart-button ${isLiked ? 'liked' : ''}`} aria-label={isLiked ? 'Unlike current song' : 'Like current song'} title={isLiked ? 'Unlike' : 'Like'} onClick={() => onToggleLike?.(currentTrack)}><Heart size={17} fill={isLiked ? 'currentColor' : 'none'} /></button><button type="button" className="player-icon-button" aria-label="Add current song to playlist" title="Add to playlist" onClick={() => onRequestPlaylist?.(currentTrack)}><ListMusic size={17} /></button></>
  const dockControls = <><div className="secondary-controls">{secondaryControls}</div><button type="button" className="player-main-button" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={handleTogglePlay}>{playIcon}</button>{likeButton}{!pipVisible && <button type="button" className="player-icon-button" aria-label="Show mini player" title="Show mini player" onClick={() => onPlaybackChange({ pipVisible: true })}><Maximize2 size={16} /></button>}</>

  const handleCurrentTrackClick = () => {
    if (!pipVisible) onPlaybackChange({ pipVisible: true })
    else setIsExpanded(true)
  }

  return <>
    {isExpanded && !isQueueOpen && <button type="button" className="mobile-queue-toggle" aria-label="Open queue" aria-expanded={isQueueOpen} onClick={() => setIsQueueOpen(true)}><ListMusic size={18} /><span>Queue</span></button>}
    {videoId && <section ref={miniPlayerPanelRef} className={`youtube-player-panel ${!pipVisible ? 'is-hidden' : ''}`} aria-label="YouTube mini player" style={pipPosition ? { left: `${pipPosition.left}px`, top: `${pipPosition.top}px`, right: 'auto', bottom: 'auto' } : undefined} onPointerDown={handleMiniPlayerPointerDown} onPointerMove={handleMiniPlayerPointerMove} onPointerUp={handleMiniPlayerPointerUp} onPointerCancel={handleMiniPlayerPointerCancel} onLostPointerCapture={handleMiniPlayerLostPointerCapture}><div ref={playerContainerRef} className="youtube-player-container" /><div className="youtube-pip-drag-layer" aria-hidden="true" onPointerDown={handleMiniPlayerPointerDown} onPointerMove={handleMiniPlayerPointerMove} onPointerUp={handleMiniPlayerPointerUp} onPointerCancel={handleMiniPlayerPointerCancel} onLostPointerCapture={handleMiniPlayerLostPointerCapture} /><div className="youtube-mini-overlay"><button type="button" className="mini-player-expand" aria-label="Expand player" onClick={() => setIsExpanded(true)}><Maximize2 size={16} /></button><button type="button" className="mini-player-close" aria-label="Close mini player" onClick={() => onPlaybackChange({ pipVisible: false })}><X size={16} /></button></div></section>}
    <section className="player-dock" aria-label="Music player"><div className="player-dock-inner"><div className="player-current" role="button" tabIndex="0" onClick={handleCurrentTrackClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleCurrentTrackClick() }}><PlayerArtwork track={currentTrack} /><span className="player-track"><strong>{currentTrack.title}</strong><small>{currentTrack.artist}</small></span></div><div className="player-controls">{dockControls}</div><div className="player-progress-wrap"><span>{formatTime(currentTime)}</span><input className="player-progress" type="range" min="0" max="100" step="0.1" value={Number.isFinite(progress) ? progress : 0} onChange={handleSeek}
onPointerUp={commitSeek}
onPointerCancel={commitSeek} aria-label="Playback progress" style={{ '--progress': `${progress}%` }} /><span>{formatTime(duration)}</span></div><div className="volume-control"><button type="button" className="player-icon-button" aria-label={isMuted ? 'Unmute' : 'Mute'} title={isMuted ? 'Unmute' : 'Mute'} onClick={handleMute}>{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><input type="range" min="0" max="100" step="1" value={isMuted ? 0 : volume} onChange={handleVolume} aria-label="Volume" /></div><button type="button" className="player-expand-button" aria-label="Open full player" title="Open full player" onClick={() => setIsExpanded(true)}><Maximize2 size={17} /></button></div></section>
    {isExpanded && <div className="player-overlay" role="presentation" onClick={() => setIsExpanded(false)}><section className="expanded-player" role="dialog" aria-modal="true" aria-label={`${currentTrack.title} player`} onClick={(event) => event.stopPropagation()}><header className="expanded-header"><button type="button" className="expanded-close" aria-label="Close player" onClick={() => setIsExpanded(false)}><ChevronDown size={21} /></button><span>NOW PLAYING</span><button type="button" className="expanded-queue-label" aria-label="Open queue" aria-expanded={isQueueOpen} onClick={() => setIsQueueOpen(true)}><ListMusic size={19} /></button></header><div className="expanded-content"><PlayerArtwork track={currentTrack} large /><p className="expanded-eyebrow">KROVI SESSION</p><h2>{currentTrack.title}</h2><p className="expanded-artist">{currentTrack.artist}</p>{!pipVisible && <button type="button" className="restore-video-button" onClick={() => onPlaybackChange({ pipVisible: true })}><Maximize2 size={16} /> Show video</button>}{likeButton}<div className="expanded-progress"><input className="player-progress" type="range" min="0" max="100" step="0.1" value={Number.isFinite(progress) ? progress : 0} onChange={handleSeek}
onPointerUp={commitSeek}
onPointerCancel={commitSeek} aria-label="Playback progress" style={{ '--progress': `${progress}%` }} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="expanded-controls">{secondaryControls}<button type="button" className="expanded-play" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={handleTogglePlay}>{expandedPlayIcon}</button></div><div className="expanded-volume"><button type="button" className="player-icon-button" aria-label={isMuted ? 'Unmute' : 'Mute'} onClick={handleMute}>{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><input type="range" min="0" max="100" step="1" value={isMuted ? 0 : volume} onChange={handleVolume} aria-label="Volume" /></div></div><aside className="queue-panel"><div className="queue-heading"><div><p className="expanded-eyebrow">UP NEXT</p><h3>Your queue</h3></div><button type="button" className="queue-clear" onClick={onClearQueue}>Clear queue</button></div><div className="queue-current"><PlayerArtwork track={currentTrack} /><span><strong>{currentTrack.title}</strong><small>{currentTrack.artist}</small></span></div>{queue.length > 1 ? <div className="queue-list">{queue.filter((_, index) => index !== currentQueueIndex).map((queuedTrack, index) => <div className="queue-song" key={`${queuedTrack.videoId || queuedTrack.title}-${index}`}><button type="button" className="queue-song-main" onClick={() => { playTrack(queuedTrack, { autoplay: true, queue }); setIsExpanded(false) }}><PlayerArtwork track={queuedTrack} /><span><strong>{queuedTrack.title}</strong><small>{queuedTrack.artist}</small></span></button><button type="button" className="queue-remove" aria-label={`Remove ${queuedTrack.title} from queue`} title="Remove from queue" onClick={() => onRemoveFromQueue?.(queuedTrack.videoId)}><Trash2 size={15} /></button><button type="button" className="queue-remove" aria-label={`Add ${queuedTrack.title} to playlist`} title="Add to playlist" onClick={() => onRequestPlaylist?.(queuedTrack)}><ListMusic size={15} /></button></div>)}</div> : <p className="queue-empty">Your queue is clear.</p>}</aside></section></div>}
    {isQueueOpen && <QueueDrawer queue={queue} currentQueueIndex={currentQueueIndex} onSelectTrack={onSelectTrack} onRemoveFromQueue={onRemoveFromQueue} onClearQueue={onClearQueue} onClose={() => setIsQueueOpen(false)} />}
  </>
}

export default Player
