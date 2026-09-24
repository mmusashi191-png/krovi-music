import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Heart,
  ListPlus,
  MoreHorizontal,
  Play,
  Plus,
  Shuffle,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react'

function PlaylistCover({ track, playlist, large = false }) {
  const image = track?.thumbnail || playlist?.coverImage || playlist?.tracks?.[0]?.thumbnail || playlist?.songs?.[0]?.thumbnail
  return (
    <span className={'playlist-cover ' + (large ? 'large' : '')}>
      {image ? <img src={image} alt="" /> : <span className="playlist-cover-placeholder">k</span>}
    </span>
  )
}

function LibraryTabs({ tab, onChange }) {
  return (
    <div className="library-tabs" role="tablist" aria-label="Library sections">
      {[
        ['saved', 'Saved'],
        ['recent', 'Recent'],
        ['playlists', 'Playlists'],
      ].map(([key, label]) => (
        <button
          type="button"
          role="tab"
          key={key}
          aria-selected={tab === key}
          className={tab === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function TrackActions({
  track,
  saved,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onRemove,
  onRequestPlaylist,
}) {
  const [open, setOpen] = useState(false)

  return (
    <article className="library-saved-row">
      <button type="button" className="library-track-main" onClick={() => onPlay(track)}>
        <PlaylistCover track={track} />
        <span>
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </span>
      </button>

      <button
        type="button"
        className="more-button"
        aria-label={'Actions for ' + track.title}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div className="library-row-menu">
          <button type="button" onClick={() => onPlay(track)}><Play size={15} /> Play now</button>
          <button type="button" onClick={() => onAddToQueue(track)}><ListPlus size={15} /> Add to queue</button>
          <button type="button" onClick={() => onPlayNext(track)}><SkipForward size={15} /> Play next</button>
          <button type="button" onClick={() => onRequestPlaylist(track)}><Plus size={15} /> Add to playlist</button>
          {saved
            ? <button type="button" onClick={() => onToggleLike(track)}><Heart size={15} /> Unsave</button>
            : <button type="button" onClick={() => onRemove(track.videoId)}><Trash2 size={15} /> Remove</button>}
        </div>
      )}
    </article>
  )
}

function TrackCollection({
  tracks,
  saved,
  emptyTitle,
  emptyCopy,
  onExplore,
  ...actionProps
}) {
  if (!tracks.length) {
    return (
      <div className="library-empty">
        <Heart size={22} />
        <h3>{emptyTitle}</h3>
        <p>{emptyCopy}</p>
        <button type="button" className="primary-button" onClick={onExplore}>Explore music</button>
      </div>
    )
  }

  return (
    <div className="library-saved-list">
      {tracks.map((track) => (
        <TrackActions
          key={track.videoId}
          track={track}
          saved={saved}
          {...actionProps}
        />
      ))}
    </div>
  )
}

function PlaylistForm({ initial, editing, onSave, onClose }) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [coverImage, setCoverImage] = useState(initial.coverImage)

  const submit = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      name: trimmed.slice(0, 60),
      description: description.trim(),
      coverImage: coverImage.trim(),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-panel playlist-form" role="dialog" aria-modal="true" aria-label={editing ? 'Edit playlist' : 'Create playlist'} onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">LIBRARY</p>
            <h2>{editing ? 'Edit playlist' : 'New playlist'}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>

        <label>Name<input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Late nights" /></label>
        <label>Description<textarea value={description} maxLength={180} onChange={(event) => setDescription(event.target.value)} placeholder="A small collection for..." /></label>
        <label>Cover image URL<input value={coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder="Optional" /></label>

        <button type="submit" className="primary-button">{editing ? 'Save changes' : 'Create playlist'}</button>
      </form>
    </div>
  )
}

export function PlaylistPicker({ track, playlists, onAdd, onCreate, onClose }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!track) return null

  const add = (playlist) => {
    const didAdd = onAdd(playlist.id, track)
    setFeedback(didAdd ? 'Added to ' + playlist.name : 'Already in ' + playlist.name)
  }

  const create = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const playlist = onCreate({ name: trimmed, description: '', coverImage: '' })
    onAdd(playlist.id, track)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-panel playlist-picker" role="dialog" aria-modal="true" aria-label="Add to playlist" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">SAVE TRACK</p>
            <h2>Add to playlist</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>

        <p className="modal-track-name">{track.title}</p>

        {creating ? (
          <form className="picker-create-form" onSubmit={create}>
            <label>Playlist name<input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Playlist name" /></label>
            <button type="submit" className="primary-button">Create and add</button>
            <button type="button" className="modal-secondary-action" onClick={() => setCreating(false)}>Back</button>
          </form>
        ) : (
          <>
            {playlists.length ? (
              <div className="playlist-picker-list">
                {playlists.map((playlist) => (
                  <button type="button" key={playlist.id} onClick={() => add(playlist)}>
                    <PlaylistCover playlist={playlist} />
                    <span><strong>{playlist.name}</strong><small>{playlist.songs.length} songs</small></span>
                    <Check size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="library-empty">
                <p>No playlists yet.</p>
              </div>
            )}

            <button type="button" className="modal-secondary-action" onClick={() => setCreating(true)}>
              <Plus size={16} /> Create playlist
            </button>
            {feedback && <p className="modal-message">{feedback}</p>}
          </>
        )}
      </section>
    </div>
  )
}

export default function Playlists({
  playlists,
  savedTracks,
  recentTracks,
  availableTracks,
  onCreate,
  onUpdate,
  onDelete,
  onPlayTrack,
  onPlayAll,
  onAddTrack,
  onRemoveTrack,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onRemoveRecent,
  onRequestPlaylist,
  onExplore,
}) {
  const [tab, setTab] = useState('saved')
  const [selectedId, setSelectedId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (selectedId && !playlists.some((playlist) => playlist.id === selectedId)) {
      setSelectedId(null)
    }
  }, [playlists, selectedId])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFormOpen(false)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (playlist) => {
    setEditing(playlist)
    setFormOpen(true)
  }

  const savePlaylist = (details) => {
    if (editing) onUpdate(editing.id, details)
    else onCreate(details)
    setFormOpen(false)
    setEditing(null)
  }

  const selected = playlists.find((playlist) => playlist.id === selectedId)

  if (selected) {
    const addable = availableTracks.filter((track) => !selected.songs.some((song) => song.videoId === track.videoId)).slice(0, 8)

    return (
      <section className="library-screen playlist-detail page-enter">
        <button type="button" className="back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={17} /> Library</button>

        <div className="playlist-detail-hero">
          <PlaylistCover playlist={selected} large />
          <div>
            <p className="eyebrow">PLAYLIST</p>
            <h1>{selected.name}</h1>
            <p>{selected.description || 'A collection for the songs you keep close.'}</p>
            <small>{selected.songs.length} songs</small>

            <div className="playlist-detail-actions">
              <button type="button" className="primary-button" onClick={() => onPlayAll(selected.songs)}>
                <Play size={16} fill="currentColor" /> Play all
              </button>
              <button type="button" className="icon-button" aria-label="Shuffle playlist" onClick={() => onPlayAll(selected.songs, true)}>
                <Shuffle size={17} />
              </button>
              <button type="button" className="icon-button" aria-label="Edit playlist" onClick={() => openEdit(selected)}>
                <MoreHorizontal size={17} />
              </button>
            </div>
          </div>
        </div>

        <section className="playlist-track-list">
          <header className="section-title-row">
            <div><p className="eyebrow">TRACKS</p><h2>In this playlist</h2></div>
          </header>

          {addable.length > 0 && (
            <div className="playlist-add-tracks">
              {addable.map((track) => (
                <button type="button" key={track.videoId} onClick={() => onAddTrack(selected.id, track)}>
                  <Plus size={14} /> {track.title}
                </button>
              ))}
            </div>
          )}

          {selected.songs.length ? selected.songs.map((track) => (
            <div className="playlist-track-row" key={track.videoId}>
              <button type="button" className="playlist-track-play" onClick={() => onPlayTrack(track, selected.songs)}>
                <PlaylistCover track={track} />
                <span><strong>{track.title}</strong><small>{track.artist}</small></span>
              </button>
              <button type="button" className="more-button" aria-label={'Remove ' + track.title} onClick={() => onRemoveTrack(selected.id, track.videoId)}>
                <Trash2 size={15} />
              </button>
            </div>
          )) : (
            <div className="library-empty">
              <p>This playlist is empty. Add something from your Library or Search.</p>
            </div>
          )}
        </section>

        {formOpen && (
          <PlaylistForm
            initial={editing || { name: '', description: '', coverImage: '' }}
            editing={Boolean(editing)}
            onSave={savePlaylist}
            onClose={() => setFormOpen(false)}
          />
        )}
      </section>
    )
  }

  if (tab === 'playlists') {
    return (
      <section className="library-screen page-enter">
        <header className="library-heading">
          <div>
            <p className="eyebrow">YOUR MUSIC</p>
            <h1>Library</h1>
            <p className="subcopy">Collections you built yourself.</p>
          </div>
          <button type="button" className="primary-button" onClick={openCreate}><Plus size={16} /> New playlist</button>
        </header>

        <LibraryTabs tab={tab} onChange={setTab} />

        {playlists.length ? (
          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <article className="playlist-card" key={playlist.id}>
                <PlaylistCover playlist={playlist} />
                <div>
                  <h2>{playlist.name}</h2>
                  <p>{playlist.description || 'No description'}</p>
                  <small>{playlist.songs.length} songs</small>
                </div>
                <div className="playlist-card-actions">
                  <button type="button" className="row-play" aria-label={'Play ' + playlist.name} onClick={() => onPlayAll(playlist.songs)}>
                    <Play size={15} fill="currentColor" />
                  </button>
                  <button type="button" className="text-button" onClick={() => setSelectedId(playlist.id)}>Open</button>
                  <button type="button" className="more-button" aria-label={'Delete ' + playlist.name} onClick={() => onDelete(playlist.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="library-empty">
            <h3>No playlists yet.</h3>
            <p>Create one and add songs as you discover them.</p>
            <button type="button" className="primary-button" onClick={openCreate}><Plus size={16} /> Create playlist</button>
          </div>
        )}

        {formOpen && (
          <PlaylistForm
            initial={{ name: '', description: '', coverImage: '' }}
            editing={false}
            onSave={savePlaylist}
            onClose={() => setFormOpen(false)}
          />
        )}
      </section>
    )
  }

  return (
    <section className="library-screen page-enter">
      <header className="library-heading">
        <div>
          <p className="eyebrow">YOUR MUSIC</p>
          <h1>Library</h1>
          <p className="subcopy">Keep what stays with you.</p>
        </div>
        <button type="button" className="primary-button" onClick={openCreate}><Plus size={16} /> New playlist</button>
      </header>

      <LibraryTabs tab={tab} onChange={setTab} />

      <TrackCollection
        tracks={tab === 'saved' ? savedTracks : recentTracks}
        saved={tab === 'saved'}
        emptyTitle={tab === 'saved' ? 'No saved songs yet.' : 'No recent listens yet.'}
        emptyCopy={tab === 'saved' ? 'Save something from Search and it will appear here.' : 'Play a song and your recent listens will appear here.'}
        onExplore={onExplore}
        onPlay={(track) => onPlayTrack(track, tab === 'saved' ? savedTracks : recentTracks)}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        onToggleLike={onToggleLike}
        onRemove={onRemoveRecent}
        onRequestPlaylist={onRequestPlaylist}
      />
    </section>
  )
}
