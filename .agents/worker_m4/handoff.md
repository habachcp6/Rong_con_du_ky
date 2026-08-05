# Handoff Report — worker_m4 (Milestone 4: Landmark Gallery UI & Detail Panel)

## 1. Observation

- **Files Created**:
  - `src/client/app/LandmarkGalleryPanel.tsx`: Component displaying all 10 Da Nang landmarks in a responsive grid layout (2 columns on desktop ≥640px, 1 column on mobile <640px). Shows SVG postcard thumbnail, localized title, short description, source attribution badge, and "Chi tiết / Details" button. Includes modal accessibility (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="landmark-gallery-title"`, `data-testid="landmark-gallery-panel"`).
  - `src/client/app/LandmarkDetailPanel.tsx`: Slide-up bottom sheet modal (~70vh height) displaying full 320×180 SVG postcard, category tag, full title, description/history, fun fact box, visit tip box, curated food cards (filtered from `curated-places.json` by `landmarkKey`), source attribution, and Google Maps search link. Supports modal close via `X` button, backdrop click, and Escape key (`useModalAccessibility`).
  - `tests/unit/client/gallery.test.ts`: Unit test suite verifying landmark content retrieval, location detail completeness, and food card mapping for all 10 landmarks in both Vietnamese and English.

- **Files Modified**:
  - `src/client/content.ts`: Added `getAllLocationContent(language: Language)` helper function returning all 10 `ClientLocationContent` definitions.
  - `src/client/app/App.tsx`:
    - Added "Khám phá" / "Explore" button in top header (`data-testid="landmark-gallery-open"`), positioned between Passport (`passport-open`) and Companion (`travel-tools-open`) buttons.
    - Wired `bridge.onGameToUi` listener for `OPEN_LANDMARK_DETAIL` event from Phaser bridge to open `LandmarkDetailPanel` directly when overworld POIs are activated.
    - Integrated `<LandmarkGalleryPanel>` and `<LandmarkDetailPanel>` render blocks in `<main className="app-main">`.
  - `src/client/app/App.css`: Added CSS styles, grid layout rules, media queries (<640px mobile 1 column), and `@keyframes landmarkSlideUp` animation for bottom sheet modal overlay.

- **Verification Output (`npm run verify`)**:
  ```text
  > tsc --noEmit (0 errors)
  > oxlint . (0 errors)
  > prettier --check . (All matched files use Prettier code style!)
  > vitest run (20 test files passed, 81 tests passed)
  > validate:content (✅ Content validation passed: locations=10, dialogueNodes=4, sources=26)
  > validate:assets (✅ Asset validation passed: assets=25, requiredAssets=25, tileSize=32)
  > build && validate:client-build (✅ Client build security validation passed)
  ```

---

## 2. Logic Chain

1. **Gallery Grid & Card Rendering**:
   - `getAllLocationContent(language)` retrieves the 10 landmark objects from `content/locations.vi.json` or `content/locations.en.json`.
   - `LandmarkGalleryPanel` maps through all 10 locations, rendering 2 columns on desktop and 1 column on mobile (<640px) per requirement R4.
   - Each card displays SVG thumbnail (`location.authoredImage`), title (`location.name`), short description (`location.shortDescription`), source attribution badge (`location.sourceIds`), and a detail trigger button.

2. **Detail Modal & Accessibility**:
   - `LandmarkDetailPanel` renders as a modal sliding up from the bottom occupying ~70% viewport height (`height: 70vh`).
   - Modal includes backdrop overlay (`landmark-detail-overlay`) with click-to-dismiss support, `X` close button, and Esc key dismissal + focus trap managed by `useModalAccessibility`.
   - Renders full SVG postcard, category tag, full description, fun fact box, visit tip box, curated food cards from `curated-places.json` matching `landmarkKey`, source IDs citation, and direct Google Maps URL (`https://www.google.com/maps/search/?api=1&query=...`).

3. **App Header Navigation & Phaser Bridge Integration**:
   - Added "Khám phá" / "Explore" button in top header positioned strictly between Passport and Companion buttons (`data-testid="landmark-gallery-open"`).
   - In `App.tsx`, `bridge.onGameToUi` listens for `OPEN_LANDMARK_DETAIL` events emitted by `OverworldScene` when player interacts with discoverable POIs on the map.
   - Receiving `OPEN_LANDMARK_DETAIL` automatically closes active menus and opens `LandmarkDetailPanel` for that specific landmark.

4. **Quality & Validation**:
   - Unit tests in `tests/unit/client/gallery.test.ts` test all 10 locations and food card mappings.
   - `npm run verify` passed all static analysis, linting, formatting, unit tests, content/asset validation, and production build checks.

---

## 3. Caveats

No caveats. All requirements of Milestone 4 (R4: Landmark Gallery UI & Detail Panel) are fully satisfied and verified.

---

## 4. Conclusion

Milestone 4 (R4: Landmark Gallery UI & Detail Panel) implementation is complete. All 10 landmarks are discoverable in the gallery and on the overworld, with slide-up detail modals, curated food cards, source attributions, full keyboard/aria accessibility, and header navigation.

---

## 5. Verification Method

To verify independently:
```powershell
Set-Location "D:\Hackthon-GG2026"
npm run verify
```
All 20 test suites (81 tests) and build checks will pass cleanly.
