import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Heart, ListPlus, MoreHorizontal, Play, Plus, Shuffle, SkipForward, Trash2 } from 'lucide-react'

function PlaylistCover({ playlist, large = false }) {
  const image = playlist.coverImage || playlist.songs?.[0]?.thumbnail
  return <div className={`playlist-cover ${large ? 'large' : ''}`}>{image ? <img src={image} alt="" /> : <span className="playlist-cover-placeholder">k</span>}</div>
}

function LibraryTabs({ value, onChange }) {
  return <div className="library-tabs" role="tablist" aria-label="Library sections">{[['saved', 'Saved'], ['recent', 'Recent'], ['playlists', 'Playlists']].map(([tab, label]) => <button type="button" role="tab" aria-selected={value === tab} className={value === tab ? 'active' : ''} key={tab} onClick={() => onChange(tab)}>{label}</button>)}</div>
}

function LibraryTrackList({ tracks, emptyTitle, emptyCopy, onEmptyAction, isSaved, onPlay, onAddToQueue, onPlayNext, onToggleLike, onRemove, onRequestPlaylist }) {
  if (!tracks.length) return <div className="library-empty"><Heart size={22} /><h3>{emptyTitle}</h3><p>{emptyCopy}</p><button type="button" className="primary-button" onClick={onEmptyAction}>Explore music</button></div>
  return <div className="library-saved-list">{tracks.map((track) => <LibraryTrackRow key={track.videoId} track={track} isSaved={isSaved} onPlay={onPlay} onAddToQueue={onAddToQueue} onPlayNext={onPlayNext} onToggleLike={onToggleLike} onRemove={onRemove} onRequestPlaylist={onRequestPlaylist} />)}</div>
}

function LibraryTrackRow({ track, isSaved, onPlay, onAddToQueue, onPlayNext, onToggleLike, onRemove, onRequestPlaylist }) {
  const [isOpen, setIsOpen] = useState(false)
  return <article className="library-saved-row"><button type="button" className="library-track-main" onClick={() => onPlay(track)}><PlaylistCover playlist={{ songs: [track] }} /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button><button type="button" className={`more-button ${isOpen ? 'active' : ''}`} aria-label={`Actions for ${track.title}`} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}><MoreHorizontal size={18} /></button>{isOpen && <div className="library-row-menu"><button type="button" onClick={() => onPlay(track)}><Play size={15} /> Play now</button><button type="button" onClick={() => onAddToQueue(track)}><ListPlus size={15} /> Add to queue</button><button type="button" onClick={() => onPlayNext(track)}><SkipForward size={15} /> Play next</button><button type="button" onClick={() => onRequestPlaylist(track)}><Plus size={15} /> Add to playlist</button>{isSaved ? <button type="button" onClick={() => onToggleLike(track)}><Heart size={15} /> Unsave</button> : <button type="button" onClick={() => onRemove(track.videoId)}><Trash2 size={15} /> Remove</button>}</div>}</article>
}

export function PlaylistPicker({ track, playlists, onAdd, onCreate, onClose }) {
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  if (!track) return null
  const handleAdd = (playlist) => {
    const added = onAdd(playlist.id, track)
    setMessage(added ? `Added to ${playlist.name}` : `${track.title} is already in ${playlist.name}`)
  }
  const createAndAdd = (event) => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed) { setError('Give your playlist a name.'); return } const playlist = onCreate({ name: trimmed, description: '' }); onAdd(playlist.id, track); setMessage(`Added to ${playlist.name}`); setCreating(false); setName(''); setError('') }
  return <div className="modal-backdrop" onClick={onClose}><section className="playlist-picker modal-panel" role="dialog" aria-modal="true" aria-label="Add to playlist" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">SAVE TRACK</p><h2>Add to playlist</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button></header><p className="modal-track-name">{track.title}</p>{creating ? <form className="picker-create-form" onSubmit={createAndAdd}><label>Playlist name<input autoFocus required maxLength={60} value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder="Playlist name" /></label>{error && <p className="modal-message">{error}</p>}<button type="submit" className="primary-button">Create and add</button></form> : <><div className="playlist-picker-list">{playlists.map((playlist) => <button type="button" key={playlist.id} onClick={() => handleAdd(playlist)}><PlaylistCover playlist={playlist} /><span><strong>{playlist.name}</strong><small>{playlist.songs.length} songs</small></span><Check size={16} /></button>)}</div><button type="button" className="modal-secondary-action" onClick={() => setCreating(true)}><Plus size={16} /> Create playlist</button></>}{message && <p className="modal-message">{message}</p>}</section></div>
}

export default function Playlists({ playlists, savedTracks = [], recentTracks = [], availableTracks = [], onCreate, onUpdate, onDelete, onPlayTrack, onPlayAll, onAddTrack, onRemoveTrack, onAddToQueue, onPlayNext, onToggleLike, onRemoveRecent, onRequestPlaylist, onRequestPicker, onExplore }) {
  const [selectedId, setSelectedId] = useState(null)
  const [libraryTab, setLibraryTab] = useState('saved')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', coverImage: '' })
  const [formError, setFormError] = useState('')
  const selected = playlists.find((playlist) => playlist.id === selectedId)
  const openCreate = () => { setForm({ name: '', description: '', coverImage: '' }); setFormError(''); setEditing(null); setIsCreateOpen(true) }
  const submit = (event) => { event.preventDefault(); const name = form.name.trim(); if (!name) { setFormError('Give your playlist a name.'); return } if (editing) onUpdate(editing.id, { ...form, name: name.slice(0, 60) }); else onCreate({ ...form, name: name.slice(0, 60) }); setIsCreateOpen(false); setFormError('') }
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape' && isCreateOpen) setIsCreateOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isCreateOpen])
  const openEdit = () => { setForm({ name: selected.name, description: selected.description, coverImage: selected.coverImage }); setEditing(selected); setIsCreateOpen(true) }
  if (libraryTab !== 'playlists') return <section className="library-screen"><div className="explore-heading library-heading"><div><p className="eyebrow">YOUR MUSIC</p><h1>Library</h1><p className="subcopy">Keep the songs that stay with you.</p></div></div><LibraryTabs value={libraryTab} onChange={setLibraryTab} /><LibraryTrackList tracks={libraryTab === 'saved' ? savedTracks : recentTracks} emptyTitle={libraryTab === 'saved' ? 'No saved songs yet' : 'No listening history yet'} emptyCopy={libraryTab === 'saved' ? 'Save a song from Explore and it will live here.' : 'Play something from Explore to start your history.'} onEmptyAction={onExplore} isSaved={libraryTab === 'saved'} onPlay={(track) => onPlayTrack(track, libraryTab === 'saved' ? savedTracks : recentTracks)} onAddToQueue={onAddToQueue} onPlayNext={onPlayNext} onToggleLike={onToggleLike} onRemove={onRemoveRecent} onRequestPlaylist={onRequestPlaylist || onRequestPicker} /></section>
  if (selected) return <section className="library-screen playlist-detail"><button type="button" className="back-library" onClick={() => setSelectedId(null)}><ArrowLeft size={16} /> All playlists</button><div className="playlist-detail-hero"><PlaylistCover playlist={selected} large /><div><p className="eyebrow">PLAYLIST</p><h1>{selected.name}</h1><p>{selected.description || 'A collection for your mood.'}</p><small>{selected.tracks.length} tracks</small><div className="playlist-detail-actions"><button type="button" className="primary-button" onClick={() => onPlayAll(selected.tracks)}><Play size={17} fill="currentColor" /> Play all</button><button type="button" className="secondary-icon-action" aria-label="Shuffle playlist" title="Shuffle playlist" onClick={() => onPlayAll(selected.tracks, true)}><Shuffle size={17} /></button><button type="button" className="secondary-icon-action" aria-label="Edit playlist" title="Edit playlist" onClick={openEdit}><MoreHorizontal size={17} /></button></div></div></div><div className="playlist-track-list"><div className="section-heading"><h2>Tracks</h2><span className="text-button"><Plus size={15} /> Add from below</span></div>{availableTracks.length > 0 && <div className="playlist-add-tracks">{availableTracks.filter((track) => !selected.tracks.some((item) => item.videoId === track.videoId)).slice(0, 8).map((track) => <button type="button" key={track.videoId} onClick={() => onAddTrack(selected.id, track)}><Plus size={14} /> {track.title}</button>)}</div>}{selected.tracks.length ? selected.tracks.map((track) => <div className="playlist-track-row" key={track.videoId}><button type="button" className="playlist-track-play" onClick={() => onPlayTrack(track, selected.tracks)}><PlaylistCover playlist={{ tracks: [track] }} /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button><button type="button" className="queue-remove" aria-label={`Remove ${track.title}`} title="Remove from playlist" onClick={() => onRemoveTrack(selected.id, track.videoId)}><Trash2 size={15} /></button></div>) : <div className="library-empty"><p>This playlist is empty. Add songs from Search or your Library.</p></div>}</div>{isCreateOpen && <PlaylistForm form={form} editing={editing} setForm={setForm} onSubmit={submit} onClose={() => setIsCreateOpen(false)} />}</section>
  return <section className="library-screen"><div className="explore-heading library-heading"><div><p className="eyebrow">YOUR MUSIC</p><h1>Library</h1><p className="subcopy">Small collections for the moments that matter.</p></div><button type="button" className="primary-button" onClick={openCreate}><Plus size={17} /> Create playlist</button></div><LibraryTabs value={libraryTab} onChange={setLibraryTab} />{playlists.length ? <div className="playlist-grid">{playlists.map((playlist) => <article className="playlist-card" key={playlist.id}><PlaylistCover playlist={playlist} /><div><h2>{playlist.name}</h2><p>{playlist.description || 'No description'}</p><small>{playlist.tracks.length} tracks</small></div><div className="playlist-card-actions"><button type="button" className="row-play" aria-label={`Play ${playlist.name}`} onClick={() => onPlayAll(playlist.tracks)}><Play size={15} fill="currentColor" /></button><button type="button" className="text-button" onClick={() => setSelectedId(playlist.id)}>Open</button><button type="button" className="more-button" aria-label={`Delete ${playlist.name}`} onClick={() => onDelete(playlist.id)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="library-empty"><h3>No playlists yet</h3><p>Create a playlist from the button above.</p><button type="button" className="primary-button" onClick={openCreate}><Plus size={16} /> Create playlist</button></div>}{isCreateOpen && <PlaylistForm form={form} editing={editing} setForm={setForm} onSubmit={submit} onClose={() => setIsCreateOpen(false)} />}</section>
}

function PlaylistForm({ form, editing, setForm, onSubmit, onClose, error }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal-panel playlist-form" role="dialog" aria-modal="true" aria-label={editing ? 'Rename playlist' : 'Create playlist'} onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">KROVI LIBRARY</p><h2>{editing ? 'Rename playlist' : 'Create playlist'}</h2></div><button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button></header><label>Name<input autoFocus required maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Morning light" /></label>{error && <p className="modal-message">{error}</p>}<label>Description <span>optional</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A little context for this collection" /></label><footer><button type="button" className="modal-secondary-action" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{editing ? 'Save changes' : 'Create playlist'}</button></footer></form></div>
}

