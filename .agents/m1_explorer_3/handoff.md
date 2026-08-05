# Handoff Report — Explorer 3 (Test Assertions & Extension Updates)

## 1. Observation

Direct code inspection of unit tests, E2E tests, validator scripts, and definition schemas in `d:\Hackthon-GG2026` revealed exact line numbers, file paths, and verbatim assertions that hardcode or expect `.svg` asset extensions or 32×32 icon dimensions:

### 1. Unit Tests (`tests/unit/`)

- **`tests/unit/client/gallery.test.ts`**:
  - **Line 27**:
    ```ts
    expect(location.authoredImage).toMatch(/^\/assets\/landmarks\/.*\.svg$/);
    ```
    Asserts that `authoredImage` returned by location content helpers matches `.svg`.

- **`tests/unit/content/asset-validation.test.ts`**:
  - **Line 87**:
    ```ts
    landmark.path = "/assets/landmarks/not-present.svg";
    ```
    Uses `.svg` extension in fixture mutation test for missing asset validation.
  - **Lines 120–129**:
    ```ts
    for (const asset of manifest.assets.filter(
      (entry) => entry.category === "landmark" || entry.category === "landmark_icon",
    )) {
      const svg = fs.readFileSync(path.join(projectRoot, "public", asset.path), "utf8");
      expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
    }
    ```
    Reads landmark and icon assets as UTF-8 XML text strings and runs `extractSvgColors` on them.
  - **Lines 148–168**:
    ```ts
    expect(icon.width).toBe(32);
    expect(icon.height).toBe(32);
    expect(icon.alpha).toBe(true);
    expect(icon.placeholder).toBe(false);
    expect(icon.path).toMatch(/^\/assets\/landmark-icons\/.+\.svg$/u);
    expect(icon.grid).toEqual({
      tileWidth: 32,
      tileHeight: 32,
      columns: 1,
      rows: 1,
    });

    const iconPath = path.join(projectRoot, "public", String(icon.path));
    const svg = fs.readFileSync(iconPath, "utf8");
    expect(svg).toContain('data-landmark-icon="true"');
    expect(extractSvgColors(svg).size).toBeGreaterThanOrEqual(5);
    expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
    expect(svg).not.toMatch(
      /<rect\b(?=[^>]*\bwidth=["']32["'])(?=[^>]*\bheight=["']32["'])/u,
    );
    fingerprints.add(svg);
    ```
    Asserts 32×32 dimensions, `.svg` path regex, reads UTF-8 SVG string, checks `data-landmark-icon="true"` SVG attribute, SVG color palette bounds, and `<rect>` tag regex.
  - **Line 183**:
    ```ts
    "assets/landmark-icons/dragon-bridge.svg",
    ```
    Uses `.svg` extension in palette mutation test fixture.
  - **Line 245**:
    ```ts
    icon.path = "/assets/landmark-icons/han-market.svg";
    ```
    Uses `.svg` extension in binding mismatch test fixture.

- **`tests/unit/content/landmark-content.test.ts`**:
  - **Line 116**:
    ```ts
    it("verifies landmark SVG postcard asset files exist in public/assets/landmarks/", () => {
    ```
    Test description title explicitly refers to "SVG postcard asset files".
  - **Line 122**:
    ```ts
    `Authored SVG image '${item.authoredImage}' does not exist at '${imagePath}'`,
    ```
    Error message explicitly refers to "Authored SVG image".

- **`src/shared/landmark-game-definitions.ts`** (Tested by `tests/unit/shared/game-state.test.ts`):
  - **Lines 49, 59, 69, 79, 89, 99, 109, 119, 129, 139**:
    ```ts
    mapIconPath: "/assets/landmark-icons/<landmark-name>.svg",
    ```
    All 10 definition entries specify `.svg` paths.
  - **Line 194**:
    ```ts
    !definition.mapIconPath.endsWith(".svg")
    ```
    `validateLandmarkGameDefinitions()` enforces `.svg` file extension.

---

### 2. Playwright E2E Tests (`tests/e2e/`)

- **`tests/e2e/landmark-gallery.spec.ts`**:
  - **Line 118**:
    ```ts
    await expect(detailImg).toHaveAttribute(
      "src",
      "/assets/landmarks/ba-na-hills.svg",
    );
    ```
    Asserts exact DOM `src` attribute ending in `/assets/landmarks/ba-na-hills.svg`.

- **`tests/e2e/discoverable-pois.spec.ts`**:
  - **Line 105**:
    ```ts
    await expect(challenge.locator("img")).toHaveAttribute(
      "src",
      "/assets/landmark-icons/han-river-bridge.svg",
    );
    ```
    Asserts exact DOM `src` attribute ending in `/assets/landmark-icons/han-river-bridge.svg`.

---

## 2. Logic Chain

1. **Observation 1** (`tests/unit/client/gallery.test.ts:27`) demonstrates an explicit regex expectation `/^\/assets\/landmarks\/.*\.svg$/`. When location content JSONs (`locations.vi.json` and `locations.en.json`) are updated to specify PNG postcard paths (`/assets/landmarks/<name>.png`), running `npm run test` / `vitest` will fail this assertion. Updating the regex to `/^\/assets\/landmarks\/.*\.(png|svg)$/` (or `/^\/assets\/landmarks\/.*\.png$/`) allows unit tests to pass cleanly.
2. **Observation 2** (`tests/unit/content/asset-validation.test.ts`) shows multiple assertions tied to SVG format and 32×32 icon sizes. Specifically:
   - Line 87, 183, 245 use fixture strings with `.svg`. Updating these to `.png` ensures test fixtures remain synchronized with `manifest.json`.
   - Lines 120–129 and 148–168 attempt to parse PNG files as UTF-8 SVG text and call `extractSvgColors()`. Passing binary PNG data into SVG XML string parsers will fail or return invalid color counts. Additionally, line 148–158 checks `width === 32`, `height === 32`, and `grid` tile size 32×32, whereas follow-up requirement R3 mandates 48×48px PNG map icons.
   - Therefore, `asset-validation.test.ts` must be updated to check 48×48 dimensions for map icons, match `.png` (or `.(png|svg)`) paths, and replace SVG XML string checks with binary PNG header verification (`Buffer.from([0x89, 0x50, 0x4e, 0x47])`) for PNG assets.
3. **Observation 3** (`tests/unit/content/landmark-content.test.ts:116,122`) relies on dynamic reading of `item.authoredImage` (which exists). Although `fs.existsSync` will pass once files exist, updating the test description and failure error message from "SVG" to "PNG" / "postcard" avoids misleading log messages.
4. **Observation 4** (`src/shared/landmark-game-definitions.ts:194`) shows that `validateLandmarkGameDefinitions()` explicitly rejects `mapIconPath` unless it ends in `.svg`. Since `tests/unit/shared/game-state.test.ts:76` invokes `validateLandmarkGameDefinitions()`, changing `mapIconPath` to `.png` in manifest and definitions without updating line 194 will cause `game-state.test.ts` to fail validation. Updating line 194 to check `.endsWith(".png")` (or `/\.(png|svg)$/.test()`) keeps validation aligned.
5. **Observation 5** (`tests/e2e/landmark-gallery.spec.ts:118` and `tests/e2e/discoverable-pois.spec.ts:105`) demonstrates hardcoded `.svg` DOM attribute expectations in Playwright E2E tests. When React components render `<img>` elements pointing to PNG assets (`/assets/landmarks/ba-na-hills.png` and `/assets/landmark-icons/han-river-bridge.png`), Playwright strict attribute checks will fail. Updating these assertions to match `.png` ensures E2E test execution passes against Docker and local test servers.

---

## 3. Detailed Proposed Updates

Below are the exact code replacements required for implementers across each file:

### Proposed Edit 1: `tests/unit/client/gallery.test.ts`
- **Location**: Line 27
- **Target Content**:
  ```ts
        expect(location.authoredImage).toMatch(/^\/assets\/landmarks\/.*\.svg$/);
  ```
- **Replacement Content**:
  ```ts
        expect(location.authoredImage).toMatch(
          /^\/assets\/landmarks\/.*\.(png|svg)$/,
        );
  ```

---

### Proposed Edit 2: `tests/unit/content/asset-validation.test.ts`
- **Location**: Line 87
  ```ts
      landmark.path = "/assets/landmarks/not-present.png";
  ```
- **Location**: Lines 120–130 (Update SVG text reading to handle PNG or format check)
  ```ts
      for (const asset of manifest.assets.filter(
        (entry) =>
          entry.category === "landmark" || entry.category === "landmark_icon",
      )) {
        const assetPath = path.join(projectRoot, "public", asset.path);
        if (asset.format === "svg") {
          const svg = fs.readFileSync(assetPath, "utf8");
          expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
        } else {
          const buffer = fs.readFileSync(assetPath);
          expect(buffer.subarray(0, 4)).toEqual(
            Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          );
        }
      }
  ```
- **Location**: Lines 148–170 (Update icon dimensions to 48×48 and path regex/binary checks)
  ```ts
      for (const icon of icons) {
        expect(icon.width).toBe(48);
        expect(icon.height).toBe(48);
        expect(icon.alpha).toBe(true);
        expect(icon.placeholder).toBe(false);
        expect(icon.path).toMatch(/^\/assets\/landmark-icons\/.+\.(png|svg)$/u);
        expect(icon.grid).toEqual({
          tileWidth: 48,
          tileHeight: 48,
          columns: 1,
          rows: 1,
        });

        const iconPath = path.join(projectRoot, "public", String(icon.path));
        if (icon.path.endsWith(".svg")) {
          const svg = fs.readFileSync(iconPath, "utf8");
          expect(svg).toContain('data-landmark-icon="true"');
          expect(extractSvgColors(svg).size).toBeGreaterThanOrEqual(5);
          expect(extractSvgColors(svg).size).toBeLessThanOrEqual(8);
          fingerprints.add(svg);
        } else {
          const buffer = fs.readFileSync(iconPath);
          expect(buffer.subarray(0, 4)).toEqual(
            Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          );
          fingerprints.add(buffer.toString("base64"));
        }
      }
  ```
- **Location**: Line 183
  ```ts
          "assets/landmark-icons/dragon-bridge.png",
  ```
- **Location**: Line 245
  ```ts
      icon.path = "/assets/landmark-icons/han-market.png";
  ```

---

### Proposed Edit 3: `tests/unit/content/landmark-content.test.ts`
- **Location**: Line 116 & 122
  ```ts
    it("verifies landmark postcard asset files exist in public/assets/landmarks/", () => {
      for (const key of EXPECTED_LANDMARK_KEYS) {
        const item = locationsVi[key];
        const imagePath = path.join(projectRoot, "public", item.authoredImage);
        expect(
          fs.existsSync(imagePath),
          `Authored image '${item.authoredImage}' does not exist at '${imagePath}'`,
        ).toBe(true);
      }
    });
  ```

---

### Proposed Edit 4: `src/shared/landmark-game-definitions.ts`
- **Location**: Lines 49, 59, 69, 79, 89, 99, 109, 119, 129, 139
  Change all `mapIconPath` paths from `.svg` to `.png` (e.g. `/assets/landmark-icons/dragon-bridge.png`).
- **Location**: Line 194
  ```ts
        !/\.(png|svg)$/.test(definition.mapIconPath)
  ```

---

### Proposed Edit 5: `tests/e2e/landmark-gallery.spec.ts`
- **Location**: Lines 116–119
- **Target Content**:
  ```ts
      await expect(detailImg).toHaveAttribute(
        "src",
        "/assets/landmarks/ba-na-hills.svg",
      );
  ```
- **Replacement Content**:
  ```ts
      await expect(detailImg).toHaveAttribute(
        "src",
        "/assets/landmarks/ba-na-hills.png",
      );
  ```

---

### Proposed Edit 6: `tests/e2e/discoverable-pois.spec.ts`
- **Location**: Lines 103–106
- **Target Content**:
  ```ts
      await expect(challenge.locator("img")).toHaveAttribute(
        "src",
        "/assets/landmark-icons/han-river-bridge.svg",
      );
  ```
- **Replacement Content**:
  ```ts
      await expect(challenge.locator("img")).toHaveAttribute(
        "src",
        "/assets/landmark-icons/han-river-bridge.png",
      );
  ```

---

## 4. Caveats

- **Read-Only Scope**: In accordance with the Explorer role guidelines, no changes were directly committed to project source files during this investigation.
- **Image Generation Dependency**: Unit tests verifying file existence (`landmark-content.test.ts`, `asset-validation.test.ts`) require that `.png` asset files (postcards, icons, map background) are generated and placed in `public/assets/` during M2/M3 before `npm run verify` passes.
- **Backwards Compatibility**: Proposed regex and validator updates use `.(png|svg)` where applicable to ensure smooth incremental transitions, while E2E tests assert the target `.png` paths.

---

## 5. Conclusion

To achieve complete test suite compliance for PNG asset migration:
1. Update regex matcher in `tests/unit/client/gallery.test.ts` line 27 to accept `.png` / `.(png|svg)`.
2. Update `tests/unit/content/asset-validation.test.ts` for 48×48px icon grid dimensions, `.png` fixture paths, and binary PNG header verification.
3. Update labels and error messages in `tests/unit/content/landmark-content.test.ts`.
4. Update `src/shared/landmark-game-definitions.ts` `mapIconPath` entries to `.png` and line 194 validation to accept `.png`.
5. Update Playwright DOM `src` attribute assertions in `tests/e2e/landmark-gallery.spec.ts` (line 118) and `tests/e2e/discoverable-pois.spec.ts` (line 105) to expect `.png`.

---

## 6. Verification Method

Once code updates and asset files are in place, verify execution with:

1. **Run Unit Tests Narrowly**:
   ```powershell
   Set-Location "d:\Hackthon-GG2026"
   npx vitest run tests/unit/client/gallery.test.ts
   npx vitest run tests/unit/content/asset-validation.test.ts
   npx vitest run tests/unit/content/landmark-content.test.ts
   npx vitest run tests/unit/shared/game-state.test.ts
   ```
   *Expected Result*: All vitest unit test suites pass.

2. **Run Full Verification Pipeline**:
   ```powershell
   npm run verify
   ```
   *Expected Result*: `✅ Content validation passed`, `✅ Asset validation passed`, typecheck, lint, format, vitest unit tests (153+ tests), and client build pass cleanly.

3. **Run Playwright E2E Tests**:
   ```powershell
   npx playwright test tests/e2e/landmark-gallery.spec.ts tests/e2e/discoverable-pois.spec.ts --workers=1
   ```
   *Expected Result*: E2E tests pass without broken image assertions or console errors.
