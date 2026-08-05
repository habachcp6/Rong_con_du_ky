## 2026-08-04T12:48:46Z
You are a teamwork_preview_worker subagent assigned to Milestone 2: Landmark SVG Art & Manifest (R2).
Your working directory is D:\Hackthon-GG2026\.agents\worker_m2. Create this directory first for metadata.

Task Instructions:
1. Create/replace all 10 landmark SVGs in public/assets/landmarks/:
   - dragon-bridge.svg
   - my-khe.svg
   - marble-mountains.svg
   - son-tra.svg
   - han-river-bridge.svg
   - linh-ung.svg
   - cham-museum.svg
   - non-nuoc.svg
   - han-market.svg
   - ba-na-hills.svg

   Each SVG MUST follow these exact rules:
   - Dimensions: 320x180 (viewBox="0 0 320 180", width="320", height="180")
   - Style: Retro 8/16-bit pixel-art style, clear pixelated shapes
   - Attributes on root <svg>: shape-rendering="crispEdges", data-pixel-art="true", data-alpha="false"
   - Strictly NO <linearGradient>, <radialGradient>, <filter>, <image>, or xlink:href
   - Self-contained inline shapes (<rect>, <path>, <circle>)
   - Detailed pixel art (aim for ~2-4KB per file, visually recognizable landmarks)
   - Harmonious color palette (max 24 colors per image)
   - 4px border frame using color #182433

2. Update public/assets/manifest.json:
   - Register all 10 landmark entries with category: "landmark", width: 320, height: 180, placeholder: false, and attributionId: "asset_landmark_art_01".

3. Update content/sources.md:
   - Ensure asset_landmark_art_01 (or matching attribution ID) exists, crediting original pixel art by the hackathon team.

4. Update scripts/validate-assets.ts:
   - Include all 10 landmark asset IDs in REQUIRED_ASSET_IDS.
   - Validate that all 10 landmark SVGs exist on disk.
   - Validate dimensions match 320x180.
   - Validate placeholder: false for all 10 landmark entries in manifest.json.
   - Validate shape-rendering="crispEdges" is present in each SVG.

5. Verification:
   - Run npm run validate:assets, npm run validate:content, and npx vitest run.
   - Include test outputs in your handoff report.

Write your handoff report to D:\Hackthon-GG2026\.agents\worker_m2\handoff.md and send a summary message to parent.
