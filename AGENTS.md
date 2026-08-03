# AGENTS.md

## Mission
Build and ship the Cloud Run MVP described in GG2026_Rong_Con_Du_Ky_AI_Agent_Blueprint.md. Prefer GitHub → Google AI Studio Starter Tier publication when eligible; keep Standard Cloud deployment as the fallback.

## Fixed architecture
- Phaser 4 + React + TypeScript + Vite.
- Fastify Node backend in the same repository and Cloud Run service.
- Firebase Anonymous Auth + Firestore.
- Gemini Interactions API on the server.
- Starter track: curated place cards + Google Maps URLs. Standard track: Places API (New) on the server.
- Do not change engine, framework, hosting target, or data store without explicit approval.

## Working rules
- Work milestone by milestone and keep docs/STATUS.md current.
- Complete and verify the Dragon Bridge vertical slice before cloning its patterns.
- Never commit secrets, .env files, service-account JSON, generated credentials, or provider responses containing private data.
- Keep game rules deterministic; Gemini never changes quest state, rewards, answers, or scores.
- Treat tourism facts as curated content requiring a source ID.
- Persist only Place IDs; do not persist Places ratings, reviews, hours, photos, or other restricted content.
- Show Google Maps and photo/review attribution whenever required.
- Add or update tests for every state transition, API schema, rules change, and bug fix.
- After code changes run the narrow tests first; before completing a milestone run npm run verify and the relevant E2E test.
- Preserve keyboard and mobile touch support.
- Use authored offline fallbacks for Gemini and Places failures.
- Do not install major new dependencies unless the current stack cannot meet an acceptance criterion.

## Required handoff
- Public Cloud Run URL.
- Setup and deploy instructions.
- Passing verification commands.
- Production smoke-test evidence.
- Known limitations and cost/quota notes.
