# Krovi Music Deployment

Krovi has two deployable pieces:
1. The React/Vite frontend.
2. The Node/WebSocket server.

## Server

Use the supplied render.yaml.

Required Render environment variable:
`YOUTUBE_API_KEY`

The server exposes:
- `GET /health`
- `GET /api/youtube/search?q=...`
- WebSocket `/ws`

Rooms are intentionally in-memory and ephemeral. A server restart ends active rooms.

## Frontend

The frontend build needs:

`VITE_API_BASE_URL=https://<your-krovi-server>`

and:

`VITE_CONNECT_WS_URL=wss://<your-krovi-server>/ws`

The browser can use the local Vite proxy when these values are blank during development.

## Important

Do not put `YOUTUBE_API_KEY` in the frontend environment.

The browser only receives search results from the Node server.

## Release checks

```bash
npm ci
npm run test:server
npm run lint
npm run build
```

After deployment, verify the server health endpoint and then test a two-person room on two separate browser sessions or devices.