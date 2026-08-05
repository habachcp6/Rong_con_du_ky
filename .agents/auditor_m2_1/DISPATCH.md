## 2026-08-04T05:51:31Z
You are a teamwork_preview_auditor subagent performing Forensic Integrity Verification for Milestone 2: Landmark SVG Art & Manifest (R2).
Your working directory is D:\Hackthon-GG2026\.agents\auditor_m2_1. Create this directory first for metadata.

Instructions:
1. Read D:\Hackthon-GG2026\.agents\ORIGINAL_REQUEST.md and D:\Hackthon-GG2026\AGENTS.md.
2. Perform forensic integrity checks on the M2 work product:
   - Verify that all 10 SVG files are genuine pixel art files meeting R2 specifications, not empty placeholders or dummy XMLs.
   - Verify asset validator genuinely checks disk files, dimensions, and placeholder flags.
   - Run `npm run validate:assets` and `npx vitest run`.
3. Report your verdict: CLEAN or INTEGRITY VIOLATION in `D:\Hackthon-GG2026\.agents\auditor_m2_1\handoff.md`. Send a summary message to parent.
