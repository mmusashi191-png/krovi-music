# Krovi Music — Professional Rebuild Checklist

Branch: rebuild/professional-foundation
Started: 2026-09-24

## Non-negotiable product rules
- Phone-first. Do not build a separate desktop product.
- Two professional visual systems:
  - Rosé — warm pink editorial music direction.
  - Verdant — darker forest/earth direction.
- No glassmorphism as the default visual language.
- No decorative UI with no product purpose.
- No fake metrics or fake social proof.
- No dead buttons or placeholder controls.
- No duplicated state ownership for playback.
- No YouTube audio extraction or bypassing YouTube playback restrictions.
- Connect is a two-person room where both participants can control playback.
- Meaningful animation only: hierarchy, state, navigation, or interaction.
- Reduced-motion users get a valid reduced-motion experience.

## Architecture target
App
- navigation/view state
- persistent library/recent/playlists
- authoritative playback state
- Connect room state
- search state

Player
- owns exactly one YouTube IFrame instance
- translates YouTube events into App playback state
- never invents a second playback state model
- never creates duplicate player instances
- all play/pause/seek/track changes use one command path

Connect service
- owns one WebSocket connection
- explicit connection lifecycle
- room request/response handling
- room-state, playback, queue, presence and chat are distinct message categories
- reconnect-safe handling
- hosted URL comes from build environment

Search
- one user search = one server request
- AbortController cancels obsolete searches
- no render-triggered network effects
- mood/direction searches use one deliberate query, not request fan-out

UI
- mobile safe-area aware
- one spacing/radius/type system
- one semantic color-token system per theme
- modal/sheet layers have explicit z-index ownership
- intentional focus states
- accessible touch targets
- no broad selector overrides or duplicate CSS blocks

## Required verification gates
[x] Repository cleanup
[x] Persistent architecture/checkpoint files
[x] Design tokens
[x] Rosé theme
[x] Verdant theme
[ ] New mobile app shell
[ ] New Home
[ ] New Explore/search
[ ] New Library/playlists
[ ] New Connect UI
[ ] New Player UI
[ ] Single YouTube player lifecycle
[ ] Local playback verification
[ ] Connect create/join verification
[ ] Two-device playback sync
[ ] Two-device seek sync
[ ] Two-device queue sync
[ ] Chat verification
[ ] Disconnect/reconnect verification
[x] Clean install
[x] Lint
[x] Production build
[ ] Final tree audit
[ ] Final UX pass

## Current phase
Phase 1 — Foundation

## Current checkpoint
1. Dedicated rebuild branch: rebuild/professional-foundation.
2. Recovery branch: before-professional-rebuild-20260924.
3. Rebuild rules and architecture are recorded in this directory.
4. Foundation, tokens, themes, repository ignores, deployment config, and CI guardrails are in place.
5. The latest fully passing verification run completed npm ci, lint, and production build.
6. The Connect server smoke test passed in two clean runs; one later run exposed the test file's ESM/CommonJS mismatch, which has since been corrected. A fresh verification after that correction is still required.
7. The hosted Render health endpoint could not be reached by the available verifier, so production WebSocket connectivity is not marked verified.
8. True drag-anywhere PiP is not yet implemented in the rebuilt player and must remain on the checklist.
9. Do not mark screen/player/Connect verification gates complete merely because they build; they require actual phone/two-client testing.

## Change log
- Keep commits grouped by coherent architectural change.
- Do not create .before-* source backups.
- Do not commit generated Android/build output.
- Do not leave temporary test UI in production.

## Handoff rule
When continuing in a new chat, read this file first and continue from the first unchecked gate. Never silently skip an earlier unchecked gate.