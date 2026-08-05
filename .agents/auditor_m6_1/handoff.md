# Forensic Audit Report — Milestone 6 (R7: Validation Scripts & Unit Tests Expansion)

**Work Product**: Milestone 6 Validation Scripts & Unit Tests (`scripts/validate-content.ts`, `scripts/validate-assets.ts`, `tests/unit/content/landmark-content.test.ts`, `tests/unit/content/food-cards.test.ts`, `tests/unit/client/gallery.test.ts`)
**Profile**: General Project (Integrity Mode: development)
**Verdict**: CLEAN

---

## 1. Observation

### Validation Scripts Analysis
- **`scripts/validate-content.ts`**:
  - `EXPECTED_LOCATION_KEYS` includes all 10 landmark keys (`dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`, `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`).
  - `validateCuratedPlaces` explicitly checks `curatedPlaces.cards.length >= 12` (line 717).
  - Lines 892-901 verify that every landmark key across all 10 landmarks has at least one associated food card.
  - Enforces VI/EN field parity, `shortDescription` word count (50–80 words), valid `tourism-fact` source citations in `content/sources.md`, asset references in `manifest.json` and on disk, and strictly forbids restricted Places API fields (`rating`, `userRatingCount`, `reviews`, `openingHours`, `openNow`, `photos`, `photoUrl`).

- **`scripts/validate-assets.ts`**:
  - `REQUIRED_ASSET_IDS` includes all 10 landmark asset IDs (`landmark_dragon_bridge` through `landmark_ba_na_hills`).
  - Enforces SVG dimensions (320x180), `viewBox="0 0 320 180"`, `shape-rendering="crispEdges"`, `data-pixel-art="true"`, and `data-alpha="false"`.
  - Forbids `<linearGradient>`, `<radialGradient>`, `<filter>`, and external `href`/`xlink:href`.
  - `extractSvgColors(svg)` limits landmark SVG color palette to <=24 unique hex colors (lines 257-267).
  - Enforces `placeholder: false` for all landmark entries in `public/assets/manifest.json` (lines 452-458).

### Unit Tests Assertion Quality Analysis
- **`tests/unit/content/landmark-content.test.ts`** (5 tests):
  - `contains exactly the 10 expected landmark keys in both VI and EN`: Asserts array length and exact key order match `EXPECTED_LANDMARK_KEYS`.
  - `maintains VI and EN parity across key, assetId, authoredImage, and sourceIds`: Asserts strict equality between localized entries.
  - `ensures shortDescription word count is between 50 and 80 words for all 10 landmarks`: Calculates word count dynamically and asserts `50 <= count <= 80`.
  - `verifies every sourceId in landmark content references a valid tourism-fact source`: Resolves source IDs against `sources.md` AST and asserts `kind === "tourism-fact"`.
  - `verifies landmark SVG postcard asset files exist in public/assets/landmarks/`: Empirically checks file existence on disk using `fs.existsSync`.

- **`tests/unit/content/food-cards.test.ts`** (6 tests):
  - `contains at least 12 food cards`: Asserts `cards.length >= 12`.
  - `covers all 10 landmarks with at least 1 food card per landmark`: Maps cards by `landmarkKey` and asserts full coverage of all 10 keys.
  - `contains a mix of budget, moderate, and premium price ranges`: Asserts set inclusion of all 3 price tiers.
  - `contains both any and vegetarian dietary options`: Asserts set inclusion of both dietary categories.
  - `ensures no card contains restricted live Places fields`: Asserts key absence for `rating`, `userRatingCount`, `reviews`, `openingHours`, `openNow`, `photos`, `photoUrl`.
  - `validates Google Maps URIs and source ID citations for every food card`: Matches URI regex pattern and asserts citation presence in `sources.md`.

- **`tests/unit/client/gallery.test.ts`** (3 tests):
  - Verifies `getAllLocationContent` returns 10 landmarks for VI and EN, complete details for detail panel rendering, and food card association.

### Forensic Anti-Cheating & Facade Check
- **No hardcoded test mocks**: All test suites load and parse actual project files (`locations.vi.json`, `locations.en.json`, `curated-places.json`, `sources.md`, `manifest.json`, SVG assets).
- **No facade implementations**: Both validation scripts contain full parsing, validation logic, and issue generation.
- **No dummy assertions**: All assertions perform meaningful state/schema validation.

### Empirical Execution Output (`npm run verify`)
Executed command output:
```
> hackthon-gg2026@0.0.0 verify
> npm run typecheck && npm run lint && npm run format:check && npm run test && npm run validate:content && npm run validate:assets && npm run build && npm run validate:client-build

> hackthon-gg2026@0.0.0 typecheck (tsc --noEmit) -> PASSED
> hackthon-gg2026@0.0.0 lint (oxlint .) -> PASSED (4 warnings in .agents, 0 errors)
> hackthon-gg2026@0.0.0 format:check (prettier --check .) -> PASSED
> hackthon-gg2026@0.0.0 test (vitest run) -> PASSED (24 test files passed, 114 tests passed)
> hackthon-gg2026@0.0.0 validate:content -> PASSED (locations=10, dialogueNodes=4, sources=26)
> hackthon-gg2026@0.0.0 validate:assets -> PASSED (assets=25, requiredAssets=25, tileSize=32)
> hackthon-gg2026@0.0.0 build -> PASSED
> hackthon-gg2026@0.0.0 validate:client-build -> PASSED (files=7, forbiddenMarkers=0)
```

---

## 2. Logic Chain

1. **Validation Script Expansion**:
   - `scripts/validate-content.ts` was updated to include all 10 landmark keys in `EXPECTED_LOCATION_KEYS` and to enforce `curatedPlaces.cards.length >= 12` alongside total coverage of all 10 landmark keys.
   - `scripts/validate-assets.ts` was updated to include all 10 landmark asset IDs, enforce color palette <= 24 hex colors for landmark SVGs, and forbid `placeholder: true` for landmark assets.
   - Both validation scripts perform active parsing and error accumulation, ensuring invalid content or assets cause build/test failure.

2. **Unit Test Expansion & Assertion Verification**:
   - New test files `tests/unit/content/landmark-content.test.ts` and `tests/unit/content/food-cards.test.ts` were inspected line-by-line.
   - Every test case tests real data from disk, using exact bounds (50-80 words, >=12 food cards, 10 landmark keys, 3 price ranges, 2 dietary options, no restricted fields).
   - No mock data or fake `expect(true).toBe(true)` shortcuts are present.

3. **Empirical Verification**:
   - `npm run verify` was run directly. All 8 verification steps (typecheck, lint, format check, unit tests, content validation, asset validation, Vite build, client security validation) succeeded with zero errors.

---

## 3. Caveats

No caveats.

---

## 4. Conclusion

**Verdict: CLEAN**

Milestone 6 (Validation Scripts & Unit Tests Expansion) complies with all requirements in `ORIGINAL_REQUEST.md` (R7) and `AGENTS.md`. Validation scripts are strict and genuine, unit tests perform real assertions, and `npm run verify` passes completely with 114 unit tests passing across 24 test suites.

---

## 5. Verification Method

To independently verify:
```powershell
Set-Location "D:\Hackthon-GG2026"
npm run verify
```
Inspect test files:
- `D:\Hackthon-GG2026\tests\unit\content\landmark-content.test.ts`
- `D:\Hackthon-GG2026\tests\unit\content\food-cards.test.ts`
- `D:\Hackthon-GG2026\tests\unit\client\gallery.test.ts`
- `D:\Hackthon-GG2026\scripts\validate-content.ts`
- `D:\Hackthon-GG2026\scripts\validate-assets.ts`
