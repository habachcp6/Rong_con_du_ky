## 2026-08-04T05:47:10Z
<USER_REQUEST>
You are a teamwork_preview_auditor subagent performing Forensic Integrity Verification for Milestone 1: Content Expansion (R1).
Your working directory is D:\Hackthon-GG2026\.agents\auditor_m1_1. Create this directory first for metadata.

Instructions:
1. Read D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md and D:\Hackthon-GG2026\AGENTS.md.
2. Perform forensic integrity checks on the M1 work product:
   - Verify that all content in `locations.vi.json`, `locations.en.json`, `curated-places.json`, and `sources.md` is genuine and complete, not hardcoded mock/stubs.
   - Verify that validation scripts genuinely validate content rather than short-circuiting.
   - Run `npm run validate:content` and `npx vitest run`.
3. Report your verdict: CLEAN or INTEGRITY VIOLATION in `D:\Hackthon-GG2026\.agents\auditor_m1_1\handoff.md`. Send a summary message to parent.
</USER_REQUEST>
