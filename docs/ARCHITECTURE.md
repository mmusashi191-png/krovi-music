# Krovi Music Architecture

Krovi is a phone-first music discovery and two-person listening app.

## Boundaries

### App
Owns navigation, persistent local data, authoritative playback state, search state, and room state.

### Player
Owns the single YouTube IFrame instance and translates player events into App commands. It does not maintain a second source of truth for playback.

### Connect service
Owns one WebSocket connection and the transport protocol. Playback, queue, presence, and chat are separate message categories.

### Search service
Owns the browser-to-server YouTube API request. Each search action produces one request and obsolete requests are aborted.

## State flow

User action → App command → playback state → Player effect → YouTube event → App state.

For room sync:

Local command → Connect message → server room state → remote client App state → Player effect.

A YouTube iframe is never treated as an independent application state store.

## Visual system

The production themes are named Rosé and Verdant. These are semantic product themes, not component-specific styling modes.

Both themes use the same layout and interaction model. Only design tokens change.

## Motion system

Motion is used for:
- view transitions
- player open/close choreography
- queue entrance
- result staging
- pressed-state feedback
- theme transitions

Motion must be subtle when it communicates continuity and more pronounced when it communicates a major spatial change. No animation exists solely to decorate empty space.

All motion is disabled or reduced under `prefers-reduced-motion: reduce`.

## Repository rules

Generated output, Android build directories, temporary backups, local environment files, and editor state are not source code and do not belong in git.
Temporary experiments must live outside the production component tree or be removed before committing.