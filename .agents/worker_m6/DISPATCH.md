## 2026-08-04T06:21:21Z
You are worker_m6 (teamwork_preview_worker) assigned to Milestone 6 (R7: Validation Scripts & Unit Tests Expansion).

Working directory: D:\Hackthon-GG2026\.agents\worker_m6
Read the following authoritative files first:
- D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md
- D:\Hackthon-GG2026\AGENTS.md
- D:\Hackthon-GG2026\.agents\orchestrator\plan.md
- D:\Hackthon-GG2026\.agents\orchestrator\handoff.md

Your Task:
1. Update and expand validation scripts:
   - `scripts/validate-content.ts`: Ensure validation checks all 10 landmarks across `locations.vi.json` and `locations.en.json`, all food cards in `curated-places.json`, source citations in `sources.md`, and references.
   - `scripts/validate-assets.ts`: Ensure validation checks all 10 landmark SVG postcards in `public/assets/landmarks/`, <=24 color palette constraint, asset manifest entries in `public/assets/manifest.json`.

2. Update and expand Unit Test Suite (`tests/unit/`):
   - Add/verify unit tests covering all 10 landmark content items, food card mappings, discoverable POIs (`world.ts`), locked quest UX prerequisite landmark names, and schema array limits up to 10.

3. Run full verification (`npm run verify`).
4. Write handoff report to `D:\Hackthon-GG2026\.agents\worker_m6\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
