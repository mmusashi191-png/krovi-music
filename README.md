# Krovi Music

Krovi is a phone-first music discovery and shared listening experience built with React, Vite, a small Node server, and WebSockets.

## Product
- Search YouTube music through the server API.
- Play videos through the official YouTube IFrame Player.
- Keep favourites, recent plays, queues, and playlists locally.
- Create or join a private two-person listening room.
- Synchronize track selection, playback, seeking, queue state, presence, and chat.
- Switch between the Rosé and Verdant visual themes.

## Local development
```bash
npm install
npm run dev
```
Vite uses port `5173`; the Node server uses port `8787`.
For a local Connect room, the client automatically uses the local server.
For a hosted frontend, set `VITE_CONNECT_WS_URL` to the deployed WebSocket endpoint before building.
The server requires `YOUTUBE_API_KEY`.

## Verification
```bash
npm run lint
npm run build
```

See `docs/ARCHITECTURE.md` and `docs/REBUILD_CHECKLIST.md` for the project boundaries and rebuild gates.

## Scope
Krovi intentionally uses the official YouTube player for YouTube playback. It does not extract or proxy YouTube audio streams.