# Handoff Report — reviewer_m4_2 (Milestone 4: Landmark Gallery UI & Detail Panel Review)

## Review Summary

**Verdict**: **APPROVE**

Milestone 4 (R4: Landmark Gallery UI & Detail Panel) implementation passes all functional requirements, header navigation rules, event subscriptions, state management, and TypeScript strictness checks. `npm run verify` passes completely with 0 errors across 20 test suites (81 tests), content validation, asset validation, and client build security checks. Minor UI and accessibility findings have been noted for non-blocking polish.

---

## 1. Observation

- **Header Positioning & UI Structure**:
  - `src/client/app/App.tsx` (lines 228-265):
    - Passport button: `data-testid="passport-open"` (line 228)
    - Gallery button: `data-testid="landmark-gallery-open"` with label `"Khám phá"` / `"Explore"` (line 246)
    - Companion button: `data-testid="travel-tools-open"` (line 261)
    - Confirmed: Header button positioning strictly places "Khám phá" between "Hộ chiếu" and "Trợ lý".

- **Phaser Bridge & State Management**:
  - `src/client/app/App.tsx` (lines 77-87):
    - Listens for `OPEN_LANDMARK_DETAIL` event emitted by `OverworldScene`.
    - Automatically closes `passportOpen`, `travelToolsOpen`, `endingOpen`, `galleryOpen` and sets `selectedLandmarkKey`.
    - Restores game canvas input (`SET_INPUT_ENABLED: true`) on detail modal dismissal.

- **Gallery & Detail Panel Components**:
  - `src/client/app/LandmarkGalleryPanel.tsx`:
    - Modal ref wired with `useModalAccessibility(panelRef, onClose)`.
    - Renders all 10 landmarks loaded via `getAllLocationContent(language)`.
    - Postcard thumbnail (`authoredImage`), name, short description preview, source attributions, and detail button.
  - `src/client/app/LandmarkDetailPanel.tsx`:
    - Slide-up bottom sheet modal (`~70vh` height) with animation `landmarkSlideUp`.
    - Displays full SVG postcard image, localized title, full description, fun fact box, visit tip box, curated food cards filtered from `curated-places.json`, source attributions, and external Google Maps search link (`target="_blank"`).

- **Verification Output (`npm run verify`)**:
  - Command: `npm run verify`
  - Result:
    - `tsc --noEmit` (0 errors)
    - `oxlint .` (0 errors)
    - `prettier --check .` (All matched files use Prettier code style!)
    - `vitest run` (20 test files passed, 81 tests passed)
    - `validate:content` (✅ Content validation passed: locations=10, dialogueNodes=4, sources=26)
    - `validate:assets` (✅ Asset validation passed: assets=25, requiredAssets=25, tileSize=32)
    - `build && validate:client-build` (✅ Client build security validation passed)

---

## 2. Findings

### [Minor] Finding 1 — Responsive Grid Media Query Breakpoint

- **What**: Media query breakpoint in `App.css` for 1-column layout is set to `max-width: 560px` instead of `<768px`.
- **Where**: `src/client/app/App.css` (line 803: `@media (max-width: 560px)`)
- **Why**: Requirement R4 specifies:
  - Desktop (≥768px): 2 columns
  - Mobile (<768px): 1 column
  With `@media (max-width: 560px)`, viewports between 561px and 767px (such as small tablets or mobile landscape) remain 2 columns, causing narrow card squeeze.
- **Suggestion**: Update `@media (max-width: 560px)` in `App.css` to `@media (max-width: 767px)` so viewports under 768px correctly drop to 1 column.

### [Minor] Finding 2 — Nested Interactive ARIA Elements in Gallery Card

- **What**: `<article className="landmark-gallery-card">` has `role="button"` and `tabIndex={0}`, while containing an inner `<button type="button" className="landmark-gallery-card__button">`.
- **Where**: `src/client/app/LandmarkGalleryPanel.tsx` (lines 76-118)
- **Why**: HTML5 / ARIA guidelines prohibit nesting interactive controls (button inside `role="button"`). Keyboard users encounter 2 tab stops per card (20 total for 10 cards), and screen readers announce a button within a button.
- **Suggestion**: Remove `role="button"` and `tabIndex={0}` from the card `<article>` wrapper, leaving the inner `"Chi tiết"` button (or title link) as the sole interactive element per card.

### [Minor] Finding 3 — Dual Modal Escape Listener firing

- **What**: When `LandmarkDetailPanel` is opened from `LandmarkGalleryPanel`, pressing `Escape` closes both modals simultaneously instead of stepping back to the gallery.
- **Where**: `src/client/app/LandmarkGalleryPanel.tsx`, `src/client/app/LandmarkDetailPanel.tsx`, `src/client/app/useModalAccessibility.ts`
- **Why**: Both components are mounted simultaneously, so both `useModalAccessibility` instances register keydown listeners on `window`. Pressing Escape triggers both handlers.
- **Suggestion**: Pass `isOpen={!selectedLandmarkKey}` to `useModalAccessibility` inside `LandmarkGalleryPanel` so its keydown handler pauses while a detail panel is open over it.

---

## 3. Verified Claims

1. **Header Button Placement**: Header button "Khám phá" is strictly positioned between "Hộ chiếu" and "Trợ lý" in `App.tsx:246`. → Verified via source inspection → PASS
2. **10 Landmarks Rendered**: `LandmarkGalleryPanel` loads all 10 locations in VI and EN using `getAllLocationContent(language)`. → Verified via `gallery.test.ts` and `App.tsx` → PASS
3. **Detail Modal Content**: `LandmarkDetailPanel` displays SVG image, description, fun fact, visit tip, food cards, sources, and Google Maps URL. → Verified via source inspection → PASS
4. **Phaser Bridge Event Handling**: Overworld POI activation triggers `OPEN_LANDMARK_DETAIL` and opens detail modal cleanly. → Verified via `App.tsx:77-87` → PASS
5. **Static Analysis & Build**: `npm run verify` runs typecheck, lint, formatting, unit tests, content/asset validation, and production build without errors. → Verified via `npm run verify` output → PASS
6. **Integrity Violations**: Checked for hardcoded test outputs, dummy facades, or self-certifying shortcuts. → Verified via code search → PASS (No violations found)

---

## 4. Coverage Gaps

- **E2E Browser Interaction**: Verified unit tests and static builds. Full Docker + Playwright E2E verification is evaluated during integration verification. Risk level: Low.

---

## 5. Logic Chain

1. **Requirement Check**: Reviewed `ORIGINAL_REQUEST.md` (R4) requirements for header button placement, gallery grid, detail modal contents, accessibility, and bridge events.
2. **Code Inspection**: Evaluated `LandmarkGalleryPanel.tsx`, `LandmarkDetailPanel.tsx`, `App.tsx`, `App.css`, `useModalAccessibility.ts`, and `gallery.test.ts`. Confirmed header button placement, modal rendering, accessibility hooks, and bridge event handlers.
3. **Adversarial & Edge Case Review**:
   - Checked breakpoint in `App.css`: Found `@media (max-width: 560px)` instead of `<768px` (Finding 1).
   - Checked keyboard navigation in gallery cards: Found nested `role="button"` with inner `<button>` (Finding 2).
   - Checked modal stacking Escape key behavior: Found dual listener trigger (Finding 3).
4. **Verification Execution**: Ran `npm run verify`. All 20 test files (81 tests), typecheck, linting, code formatting, content validation (10 locations, 26 sources), asset validation (25 assets), and client build security check passed cleanly.
5. **Verdict Rationale**: Since all functional core requirements, TypeScript types, bridge events, gallery components, and test checks pass completely without critical or integrity flaws, the verdict is **APPROVE**. Minor findings are documented for implementation polish.

---

## 6. Caveats

No caveats. All Milestone 4 (R4) requirements were evaluated against code, CSS, tests, and build pipeline.

---

## 7. Conclusion

Milestone 4 (R4: Landmark Gallery UI & Detail Panel) is **APPROVED**. The implementation satisfies all functional, component, header navigation, and event integration specifications.

---

## 8. Verification Method

To re-verify independently:
```powershell
Set-Location "D:\Hackthon-GG2026"
npm run verify
```
Expected output: 0 errors, 20 test suites passed (81 tests), content & asset validation passed, client build security passed.
