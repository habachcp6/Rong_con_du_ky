# ADR-007 — Firestore state reconciliation

- **Status:** Accepted for MVP
- **Date:** 2026-08-03
- **Owners:** O0 + persistence boundary

## Context

The game is local-first and can be played offline. A player may later sign in anonymously on another tab/device, so a blind last-write-wins policy could erase an earned Mảnh Ký Ức. Conversely, a per-field merge would complicate a deterministic quest graph and make a malformed combination easier to persist.

## Decision

1. Normalize both local and remote values through `hydrateGameState`.
2. Score irreversible campaign progress from memory fragments and per-quest status weights.
3. Take the higher-progress state in full.
4. If progress ties, take the state with the newest parseable `updatedAt`; this converges player position and preferences.
5. On first bootstrap, write the reconciled normalized projection when remote is missing or differs.
6. Debounce position writes; flush immediately for quest/reward/postcard/preference/scene transitions and visibility loss.

## Consequences

- A stale remote write cannot erase a reward.
- Exact simultaneous preference edits remain last-timestamp-wins, which is acceptable for a single anonymous player and is intentionally documented.
- Firestore is optional: Auth/remote failures retain local play and local saves.
- No Places provider response or Gemini output is persisted. Only normalized game fields may be sent to Firestore.

## Evidence

`tests/unit/firebase/firebase-game-state.test.ts` covers stronger remote progress, stale remote rejection, Auth failure, write failure and missing Firebase configuration.
