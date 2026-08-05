# Original User Request

## Initial Request — 2026-08-04T05:40:47Z

Expand the "Rồng Con Du Ký" (Little Dragon's Journey) Phaser 4 + React + TypeScript hackathon game from 4 to 10 Da Nang landmarks, replace all 4 existing landmark SVGs with higher-quality pixel art, add 6 discovery-only POIs to the overworld, expand food cards from 4 to 12, add a "Landmark Gallery" UI, improve locked-quest UX messaging, and verify everything passes in a Docker container using Playwright from native Windows PowerShell.

Working directory: D:\Hackthon-GG2026
Integrity mode: development

## Requirements

### R1. Content Expansion — 10 Bilingual Landmarks + 12 Food Cards

Expand `content/locations.vi.json` and `content/locations.en.json` from 4 to 10 entries. The 4 existing keys (`dragon_bridge`, `my_khe_beach`, `marble_mountains`, `son_tra_peninsula`) must keep their exact keys and schema but may have their `shortDescription`, `funFact`, and `visitTip` enriched with more detailed, engaging content. Add 6 new landmark keys: `han_river_bridge`, `linh_ung_son_tra`, `cham_museum`, `non_nuoc_stone_village`, `han_market`, `ba_na_hills`.

Each location entry must follow the existing schema:
```json
{
  "key": "<landmark_key>",
  "name": "<localized name>",
  "shortDescription": "<80-700 chars, 50-80 words>",
  "funFact": "<20-300 chars>",
  "visitTip": "<20-350 chars>",
  "authoredImage": "/assets/landmarks/<filename>.svg",
  "assetId": "landmark_<key>",
  "imageAttributionId": "<attribution_id>",
  "sourceIds": ["<source_id>", ...]
}
```

VI and EN files must have identical keys in identical order. All `sourceIds` must reference entries in `content/sources.md`. Every new landmark's tourism facts must be paraphrased from Da Nang's official tourism portal (danangfantasticity.com) as primary source and Wikipedia Vietnamese edition as supplementary source for historical data. Each source must be cited with a new entry in `content/sources.md` following the existing format. The writing tone must be educational and formal, matching the existing 4 landmarks' style (similar to an official tourism portal).

Expand `content/curated-places.json` from 4 to at least 12 food cards. Every landmark (all 10) must have at least 1 food card. Each card must include `nameVi`, `nameEn`, `descriptionVi`, `descriptionEn`, `address`, `priceRange` (budget/moderate/premium), `dietary` (any/vegetarian), a valid `googleMapsUri`, and `sourceIds`. Ensure a mix of budget/moderate/premium price ranges and both any/vegetarian dietary options across the full set. Cards MUST NOT contain `rating`, `reviews`, `openingHours`, `openNow`, `photos`, or `photoUrl` fields. Add corresponding source entries in `content/sources.md`.

### R2. Landmark SVG Art — 10 Pixel-Art Postcards

Replace all 4 existing SVGs in `public/assets/landmarks/` and create 6 new ones (total 10). Each SVG must be:
- 320×180 pixels (viewBox="0 0 320 180")
- Retro 8/16-bit pixel-art style: flat, minimal, using clear square/rectangular shapes
- `shape-rendering="crispEdges"` on the root `<svg>` element
- `data-pixel-art="true"` and `data-alpha="false"` attributes on root
- No gradients (`<linearGradient>`, `<radialGradient>`), no filters (`<filter>`), no external references (no `<image>`, no `xlink:href` to external URLs)
- Self-contained (all shapes inline using `<rect>`, `<path>`, `<circle>`)
- Recognizably depicting the landmark it represents with enough detail to be visually appealing (aim for 2-4KB per file, significantly more detailed than the current ~700-1000 byte placeholders)
- Using a harmonious color palette (max 24 colors per image)
- Include a 4px border frame using color `#182433` (matching existing style)

File names: `dragon-bridge.svg`, `my-khe.svg`, `marble-mountains.svg`, `son-tra.svg`, `han-river-bridge.svg`, `linh-ung.svg`, `cham-museum.svg`, `non-nuoc.svg`, `han-market.svg`, `ba-na-hills.svg`.

Update `public/assets/manifest.json` to include all 10 landmark entries with `category: "landmark"`, `placeholder: false`, correct dimensions (320×180), and a new `attributionId` (e.g. `asset_landmark_art_01`). Add the corresponding attribution entry in `content/sources.md` crediting the hackathon team's original pixel art.

### R3. Discoverable POIs in Overworld — 6 New Interactables

Add a new `DISCOVERABLE_INTERACTABLES` array in `src/client/game/world.ts` alongside the existing `QUEST_INTERACTABLES`. Each of the 6 new landmarks gets a discoverable POI marker placed at a non-overlapping position within the existing 1600×960 world bounds. Positions must not overlap with the 4 existing quest NPC positions or the 5 existing collider rectangles.

Each discoverable interactable must:
- Use a type discriminator (e.g. `type: "discovery"`) distinct from quest NPCs (`type: "npc"`)
- Have `placeKey` matching the new landmark key
- Have bilingual labels (VI/EN) following the existing `QUEST_INTERACTABLE_COPY` pattern
- Support interaction via E/Space key press and touch tap
- NOT grant memory fragments, NOT change quest status, NOT affect passport progress, NOT add to `unlockedPostcards`
- Open a `LandmarkDetailPanel` (new React component) showing the landmark's content

Visual appearance on the overworld: render as a simple circle or signpost marker in a distinct color from quest NPCs (e.g. amber/gold `0xFFD166` vs the blue/green quest NPCs), with a subtle pulsing/blinking animation to attract attention.

The `OverworldScene` must render these markers, detect proximity, show interaction hints, and emit events to the React UI layer. The detail panel must be closeable via Escape key, close button, and touch. Closing must return input focus to the game canvas.

### R4. Landmark Gallery UI

Add a "Khám phá" / "Explore" button to the app header, positioned between the existing "Hộ chiếu" (Passport) button and "Trợ lý" (Companion) button. This opens a `LandmarkGalleryPanel` (new React component) that displays all 10 landmarks in a responsive grid layout:
- Desktop (≥768px): 2 columns
- Mobile (<768px): 1 column

Each card in the grid shows:
- Landmark SVG thumbnail image
- Localized name
- Short description preview (first ~100 chars)
- A button/link to open the full `LandmarkDetailPanel` for that landmark

The `LandmarkDetailPanel` (shared with R3) is a modal that slides up from the bottom, occupying ~70% of the viewport height, with a semi-transparent dark backdrop. It is scrollable and displays:
- Full landmark SVG image
- Localized name (h2)
- Full short description
- Fun fact (highlighted section)
- Visit tip (highlighted section)
- Source IDs with labels
- Google Maps link (opens in new tab)
- Close button + Escape key support

Both panels must work in VI and EN, support keyboard navigation, have proper ARIA attributes (`role="dialog"`, `aria-modal="true"`, focus trap), and use the existing `useModalAccessibility` hook.

### R5. Regression Safety — Preserve Existing Systems

All changes must preserve:
- The 4 existing quests (`dragon_bridge_lights`, `my_khe_clean_wave`, `marble_five_elements`, `son_tra_traces`) and their state machine (`LOCKED → AVAILABLE → ACTIVE → COMPLETED → REWARDED`)
- The `QUEST_INTERACTABLES` array (coordinates, IDs, quest bindings) — do not modify
- Fragment count logic (only quest REWARDED grants fragments), passport progress, and ending gate logic (`isJourneyComplete` checks all 4 quests)
- The `GameState` type and Firestore schema (no migration needed)
- Existing dialogue files (`dialogue.vi.json`, `dialogue.en.json`) — do not modify
- All existing Playwright E2E tests must continue passing
- The `QUEST_SCENE_BY_ID` mapping and all 4 mini-game scenes — do not modify
- Update `DragonChatRequestSchema.unlockedPostcards` from `max(4)` to `max(10)` in `src/shared/schemas.ts` for future extensibility

### R6. Improved Locked Quest UX

Currently when a player approaches a locked quest NPC, the hint text says generic "hoàn thành điểm trước để mở khóa" / "finish the previous landmark to unlock". Improve this to show the **specific name** of the prerequisite landmark. For example, if Son Tra is locked, instead of "finish the previous landmark to unlock", show "Hoàn thành thử thách ở Ngũ Hành Sơn để mở khóa" / "Complete the challenge at Marble Mountains to unlock".

This affects two code locations:
1. `src/client/game/scenes/OverworldScene.ts` — the `updateInteractionState()` method that generates hint labels for locked NPCs
2. `src/client/app/GameUiOverlay.tsx` — the dialogue body for `quest_locked` nodeId

Use the quest order (`QUEST_ORDER`) and location content (`getLocationContent`) to look up the previous quest's landmark name dynamically.

### R7. Validators and Tests

Update `scripts/validate-content.ts` to:
- Require exactly 10 location keys in both language files (currently hardcoded to check 4)
- Validate VI/EN parity for all 10 entries
- Validate all 10 asset references exist in manifest
- Validate ≥12 food cards covering all 10 landmark keys (each landmark has ≥1 card)

Update `scripts/validate-assets.ts` to:
- Validate all 10 landmark SVGs exist on disk
- Validate manifest dimensions match (320×180)
- Validate `placeholder: false` for all 10 landmark entries
- Verify `shape-rendering="crispEdges"` is present in each SVG

Add unit tests for:
- The new `DISCOVERABLE_INTERACTABLES` array (correct count of 6, no position overlap with quest interactables, all have valid placeKeys)
- Content loading for all 10 landmarks in both languages
- Locked quest UX text contains the prerequisite landmark name

Add or extend Playwright E2E tests to verify:
- At least 2 discoverable POIs can be found and opened via keyboard
- The landmark gallery opens from the header, shows 10 entries, and allows opening a detail view
- Language toggle works for new gallery/detail content
- The locked quest message includes a specific landmark name
- No console errors on any new panel
- Desktop (1366×768) and mobile (390×844) viewports

### R8. Docker and Verification

All changes must pass the full verification pipeline from native Windows PowerShell (NOT WSL):
```powershell
Set-Location "D:\Hackthon-GG2026"

# Unit and static checks
npm run verify

# Docker build and health check
docker compose up --build -d
Start-Sleep -Seconds 15
Invoke-RestMethod http://127.0.0.1:8080/api/health

# Playwright E2E against Docker container
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:8080"
$env:PLAYWRIGHT_CAPTURE_VIDEO = "true"
npx playwright test --workers=1

# Cleanup
docker compose down
```

Update `docs/STATUS.md` with the new evidence. Update `README.md` if the landmark count or feature set description changes.

## Acceptance Criteria

### Content Validation
- [ ] `npm run validate:content` passes with 10 locations in each language file
- [ ] `npm run validate:content` passes with ≥12 food cards covering all 10 landmark keys
- [ ] All `sourceIds` in location and food card files reference valid entries in `content/sources.md`
- [ ] No restricted Places fields (`rating`, `reviews`, `openingHours`, `openNow`, `photos`, `photoUrl`) appear in `curated-places.json`
- [ ] VI and EN location files have identical keys in the same order

### Asset Validation
- [ ] `npm run validate:assets` passes with 10 landmark SVGs
- [ ] Each landmark SVG file is exactly 320×180 viewBox, contains `shape-rendering="crispEdges"`, has no `<filter>`, `<linearGradient>`, `<radialGradient>`, or `<image>` elements
- [ ] All 10 landmark entries in `manifest.json` have `placeholder: false`

### Functional — Game/UI
- [ ] All 6 discoverable POIs render on the overworld map as distinct markers (different color/shape from quest NPCs)
- [ ] Walking near a discoverable POI shows an interaction hint in the current language
- [ ] Pressing E/Space or tapping near a discoverable POI opens `LandmarkDetailPanel`
- [ ] `LandmarkDetailPanel` displays: SVG image (no broken image), name, description, fun fact, visit tip, source IDs, and Google Maps link
- [ ] Closing `LandmarkDetailPanel` returns game input control
- [ ] The "Khám phá" / "Explore" button appears in the header between Passport and Companion
- [ ] Clicking it opens `LandmarkGalleryPanel` with 10 landmark cards in a responsive grid
- [ ] Clicking a gallery entry opens the corresponding `LandmarkDetailPanel`
- [ ] Language toggle (VI↔EN) updates all new UI content correctly

### Locked Quest UX
- [ ] Approaching a locked quest NPC shows a hint mentioning the specific prerequisite landmark name (e.g. "Hoàn thành thử thách ở Ngũ Hành Sơn để mở khóa")
- [ ] Opening dialogue at a locked NPC shows the same specific prerequisite landmark name in the dialogue body
- [ ] Both hint and dialogue text update correctly when language is toggled

### Regression
- [ ] All 4 existing quests complete successfully (rhythm, cleanup, puzzle, traces)
- [ ] Passport shows 0-4/4 fragments — no change from new landmarks
- [ ] All pre-existing Playwright E2E tests pass (≥22 passed)
- [ ] `npm run verify` passes completely (typecheck, lint, format, test, validate:content, validate:assets, build, validate:client-build)

### Docker + Playwright E2E
- [ ] `docker compose up --build -d` succeeds and the container reaches healthy state
- [ ] `Invoke-RestMethod http://127.0.0.1:8080/api/health` returns `{"status":"ok"}`
- [ ] Playwright E2E suite passes against the Docker container at `http://127.0.0.1:8080` with `--workers=1`
- [ ] Desktop (1366×768) and mobile (390×844) viewport screenshots show no broken images, no text overflow, and no console errors
- [ ] All Docker and Playwright commands run from native Windows PowerShell (not WSL)

### Documentation
- [ ] `docs/STATUS.md` updated with new evidence rows for 10 landmarks, 12+ food cards, discoverable POIs, gallery, locked quest UX, and Docker/Playwright results
- [ ] `content/sources.md` contains valid entries for every `sourceId` referenced in content files

## Follow-up — 2026-08-05T03:57:50Z

Nâng cấp toàn bộ đồ họa bản đồ overworld và landmark assets cho game **Rồng Con Du Ký** (Phaser 4 + React + TypeScript). Chuyển từ `drawWorld()` procedural rectangles sang bản đồ pixel-art ban đêm với đồ họa riêng cho mỗi vùng địa danh Đà Nẵng.

Working directory: D:\Hackthon-GG2026
Integrity mode: development

## Requirements

### R1. Overworld Map Background — Baked Pixel-Art Night Map

Thay thế `drawWorld()` trong `src/client/game/scenes/OverworldScene.ts` (lines 235-281) bằng baked raster PNG 1600×960 pixels load qua `this.add.image()`.

**Style**: Pixel-art retro 16-bit, top-down bird's eye, **ban đêm** (dark atmosphere, đèn lantern, ánh trăng).

**Địa lý Đà Nẵng** phải thể hiện:
- Sông Hàn chảy dọc giữa bản đồ (khoảng x=650→1000)
- Bờ biển phía đông (gần Mỹ Khê, x>1300)
- Bán đảo Sơn Trà phía đông bắc
- Đất liền hai bên sông với đường phố, cây xanh
- Vùng Làng Khởi Hành (x≈248, y≈772) có đồ họa nhà nhỏ pixel-art

**10 vùng landmark** phải có đồ họa pixel-art đặc trưng trên map background:

| # | Landmark | Map Position | Đồ họa trên map |
|---|----------|-------------|-----------------|
| 1 | Cầu Rồng | (825, 474) | Cầu vàng bắc qua sông, đầu rồng, ánh lửa |
| 2 | Biển Mỹ Khê | (1382, 688) | Bờ biển cát vàng, sóng xanh, cây dừa |
| 3 | Ngũ Hành Sơn | (488, 118) | Cụm 5 đỉnh núi đá xám/xanh |
| 4 | Sơn Trà | (1182, 118) | Bán đảo rừng nhiệt đới xanh đậm |
| 5 | Cầu Sông Hàn | (760, 300) | Cầu xoay trên sông, đèn đêm |
| 6 | Linh Ứng | (1370, 310) | Tượng Phật Bà trắng trên đồi |
| 7 | Bảo Tàng Chăm | (310, 350) | Tòa nhà mái ngói đỏ, kiến trúc Pháp |
| 8 | Làng Đá Non Nước | (178, 640) | Xưởng điêu khắc, tượng đá trắng |
| 9 | Chợ Hàn | (310, 730) | Chợ hai tầng, ánh đèn sáng |
| 10 | Bà Nà Hills | (108, 118) | Cầu Vàng, bàn tay đá khổng lồ, núi cao |

**Phaser animations** overlay trên map background (không bake vào PNG):
- Sóng nước sông Hàn: Phaser tweens/particles
- Đèn lantern nhấp nháy: tweens alpha
- Hoa lửa Cầu Rồng: particle emitter
- Sóng biển Mỹ Khê: tween sprites

### R2. Landmark Postcards — 10 Pixel-Art Images (320×180)

Tạo 10 postcard images mới bằng `image_gen` với style pixel-art retro 16-bit, mỗi postcard có 1 hero element nổi bật, dễ nhận diện.

Output format: PNG (cập nhật validator + manifest để chấp nhận PNG cho category `landmark`).
Paths: `public/assets/landmarks/<landmark-name>.png`.

### R3. Map Icons Refresh — 10 Pixel-Art Icons (48×48)

Tạo 10 map icons mới bằng `image_gen`, tăng kích thước từ 32×32 lên 48×48 để dễ nhận diện hơn.
Output format: PNG với transparent background.

### R4. Integration & Validator Update

- Cập nhật `scripts/validate-assets.ts` cho phép PNG cho categories: `landmark`, `landmark_icon`, `map_background`
- Ẩn WORLD_COLLIDER rectangles: `obstacle.setAlpha(0)` hoặc `obstacle.setVisible(false)`, giữ physics body
- Cập nhật `public/assets/manifest.json`, `src/client/game/scenes/PreloadScene.ts`, `src/shared/landmark-game-definitions.ts`

### R5. Quality & Testing

- `npm run verify` phải pass 100% (153+ tests)
- Docker build + health check pass trên port 8080
- Playwright E2E tests pass

## Acceptance Criteria

- [ ] Overworld map là pixel-art ban đêm 1600x960, không còn rectangles đơn sắc
- [ ] Biển Mỹ Khê có bờ biển + sóng + cây dừa (KHÔNG phải ô vuông xanh)
- [ ] Mỗi vùng landmark có đồ họa pixel-art đặc trưng nhận diện được
- [ ] Có hiệu ứng động (sóng, đèn, lửa)
- [ ] 10 postcards mới (PNG, 320x180) tạo bằng image_gen
- [ ] 10 map icons mới (PNG, 48x48) tạo bằng image_gen
- [ ] `npm run verify` pass 100%
- [ ] Docker container build thành công và healthy trên port 8080
- [ ] E2E tests pass 100%
