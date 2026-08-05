# Handoff Report — Challenger M2: Landmark SVG Art & Manifest (R2)

## 1. Observation

- **SVGs on Disk**: All 10 landmark SVGs exist in `public/assets/landmarks/`:
  - `ba-na-hills.svg` (5014 bytes)
  - `cham-museum.svg` (4386 bytes)
  - `dragon-bridge.svg` (4650 bytes)
  - `han-market.svg` (4565 bytes)
  - `han-river-bridge.svg` (4694 bytes)
  - `linh-ung.svg` (4288 bytes)
  - `marble-mountains.svg` (3140 bytes)
  - `my-khe.svg` (4965 bytes)
  - `non-nuoc.svg` (4112 bytes)
  - `son-tra.svg` (3961 bytes)
- **Root `<svg>` Attributes**: Verified on all 10 SVGs:
  - `width="320"`, `height="180"`, `viewBox="0 0 320 180"`
  - `shape-rendering="crispEdges"`
  - `data-pixel-art="true"`
  - `data-alpha="false"`
- **Forbidden SVG Elements**: 0 `<linearGradient>`, 0 `<radialGradient>`, 0 `<filter>`, 0 `<image>`, and 0 external `href`/`xlink:href` found across all 10 SVGs.
- **Border Frame**: 4px border frame with color `#182433` present in all 10 files.
- **Manifest Integration**: All 10 landmarks exist in `public/assets/manifest.json` with `category: "landmark"`, `placeholder: false`, `width: 320`, `height: 180`, `alpha: false`, and `attributionId: "asset_landmark_art_01"`.
- **Sources Attribution**: `## asset_landmark_art_01` exists in `content/sources.md` with `Kind: asset-attribution`.
- **Existing Asset Validator**: Command `npm run validate:assets` exited with code 0 (`assets=25, requiredAssets=25, tileSize=32`).
- **Vitest Unit Tests**: Command `npx vitest run` passed all 19 test files (75 tests total).
- **Color Palette Empirical Violation**:
  - Requirement R2 states: *"Using a harmonious color palette (max 24 colors per image)"*.
  - Manifest specifies: `"palette": { "maxColors": 24, "style": "top-down-pixel-art" }`.
  - Empirical execution of `.agents/challenger_m2_1/color_analysis.ts` revealed that 4 SVG files exceed the 24 unique color limit:
    1. `public/assets/landmarks/my-khe.svg`: 33 distinct fill/stroke colors (exceeds limit by 9 colors).
    2. `public/assets/landmarks/linh-ung.svg`: 27 distinct fill/stroke colors (exceeds limit by 3 colors).
    3. `public/assets/landmarks/cham-museum.svg`: 26 distinct fill/stroke colors (exceeds limit by 2 colors).
    4. `public/assets/landmarks/han-market.svg`: 27 distinct fill/stroke colors (exceeds limit by 3 colors).

## 2. Logic Chain

1. **Premise**: Requirement R2 explicitly dictates that every landmark SVG must use a maximum of 24 colors (`max 24 colors per image`), matching the manifest palette specification (`"maxColors": 24`).
2. **Observation**: Executing direct color extraction across all fill, stroke, and inline style attributes in the SVGs showed:
   - `my-khe.svg`: 33 colors
   - `linh-ung.svg`: 27 colors
   - `cham-museum.svg`: 26 colors
   - `han-market.svg`: 27 colors
3. **Observation**: The existing validator (`scripts/validate-assets.ts`) checks root SVG attributes, dimensions, viewBox, absence of gradients/filters/images, and manifest `maxColors <= 32`, but does not parse or check unique color counts per SVG file.
4. **Deduction**: Because 4 out of 10 landmark SVGs violate the explicit max-24-colors specification from Requirement R2, the implementation has an empirical specification defect.
5. **Mitigation Path**:
   - Palette consolidate/unify color shades in `my-khe.svg`, `linh-ung.svg`, `cham-museum.svg`, and `han-market.svg` to bring distinct fill/stroke hex colors to 24 or fewer.
   - Extend `scripts/validate-assets.ts` to count unique colors per SVG and enforce `uniqueColors <= manifest.palette.maxColors` to prevent future regressions.

## 3. Caveats

- **Visual Quality**: Consolidating colors in `my-khe.svg` (from 33 to <=24) should be done carefully to preserve visual readability of the beach scene.
- **Scope**: No other milestone 2 defects (XML schema, asset manifest mapping, content location parity) were observed; all other checks passed 100%.

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

**Action Required**:
1. Consolidate color palettes in `my-khe.svg` (reduce from 33 to ≤24 colors), `linh-ung.svg` (reduce from 27 to ≤24), `cham-museum.svg` (reduce from 26 to ≤24), and `han-market.svg` (reduce from 27 to ≤24).
2. (Optional but recommended) Add an automated per-SVG color count assertion in `scripts/validate-assets.ts` to ensure `maxColors: 24` is enforced programmatically.

## 5. Verification Method

To independently reproduce and verify this finding:

1. Run the empirical color analysis script:
   ```powershell
   npx tsx D:\Hackthon-GG2026\.agents\challenger_m2_1\color_analysis.ts
   ```
2. Observe output:
   - `my-khe.svg`: 33 colors
   - `linh-ung.svg`: 27 colors
   - `cham-museum.svg`: 26 colors
   - `han-market.svg`: 27 colors
3. Run asset validator and vitest:
   ```powershell
   npm run validate:assets
   npx vitest run
   ```
