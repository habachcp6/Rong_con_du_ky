# Kiến trúc MVP

## Boundary runtime

```text
Browser
  React UI ── typed bridge ── Phaser scenes / deterministic reducer
     │                               │
     ├── localStorage (always)       └── quest/reward/postcard authority
     ├── Firebase Auth + Firestore (optional mirror)
     └── same-origin /api
                 │
             Fastify / Cloud Run
                 ├── Firebase Admin token verification
                 ├── curated Starter recommendation filter
                 └── Gemini Interactions API + schema/retry/fallback
```

Phaser never exposes scene internals to React. `PhaserBridge` only passes typed dialogue, quest, postcard and input events. The shared reducer owns the sole legal quest graph:

```text
LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED
                    └──────────────→ AVAILABLE  (retry only)
```

Gemini receives a small approved context and can return dialogue/hints/itinerary only. Its API schema and a server semantic guard prohibit it from changing state, rewards, scores, puzzle answers, or adding an itinerary stop that the player has not unlocked.

## Persistence

`GameSession` writes localStorage first. The browser dynamically imports Firebase only after initial playability; missing config, Auth failure and Firestore failure leave the game playable and saved locally. Firestore writes normalized `GameState` only—not Places ratings, reviews, hours, photos, raw Gemini output or chat history.

Merge rule is documented in [ADR-007](ADR-007-firestore-state-reconciliation.md): irreversible quest progress wins; equal progress uses newest `updatedAt` for position/preferences convergence. Firestore rules enforce UID ownership, state shape, ordered quest transitions and postcard/reward correspondence. This is not an anti-cheat system; the MVP has no leaderboard or valuable economy.

`npm run test:rules` starts local Auth and Firestore Emulators with the checked-in rules and exercises both permitted and denied state access. It is intentionally separate from the fast default unit suite and is not evidence that a production Firebase project has been configured.

## Service contracts

- `/api/health`: unauthenticated health/version/track.
- `/api/dragon/chat`: authenticated, Zod request/response, Gemini timeout/retry, authored fallback.
- `/api/recommendations`: authenticated Starter curated filter only.
- `/api/itinerary`: authenticated structured itinerary limited to unlocked postcard keys.
- `/api/places/*`: explicitly `501 STANDARD_TRACK_DISABLED` until human approval changes the track.

Fastify uses a 32 KiB body cap, global and uid+IP rate limits, production same-origin behavior, no-store API responses and response security headers. Server secrets are never bundled into Vite.

## Content and display policy

`content/*.json` is canonical; source IDs point to [content/sources.md](../content/sources.md). VI/EN parity is validated. Starter cards contain only authored text, source IDs and Google Maps URLs. The currently bundled graphics are team-owned placeholder SVGs; release needs final rights approval.

## Deployment topology

Build creates `dist/` for the client and `build/server/` for Fastify. The production image is multi-stage Node 24 Alpine and copies only runtime dependencies, build artifacts and canonical content. Cloud Run is the intended public host; AI Studio Starter is preferred when the user account is eligible, otherwise Standard Cloud Run is the approved fallback after human authorization.
