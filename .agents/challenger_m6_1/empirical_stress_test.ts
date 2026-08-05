import fs from "node:fs";
import path from "node:path";
import { validateContentData } from "../../scripts/validate-content.ts";
import { validateAssetManifest } from "../../scripts/validate-assets.ts";

const projectRoot = path.resolve(process.cwd());
const contentDir = path.join(projectRoot, "content");
const publicDir = path.join(projectRoot, "public");

const locationsVi = JSON.parse(fs.readFileSync(path.join(contentDir, "locations.vi.json"), "utf8"));
const locationsEn = JSON.parse(fs.readFileSync(path.join(contentDir, "locations.en.json"), "utf8"));
const dialogueVi = JSON.parse(fs.readFileSync(path.join(contentDir, "dialogue.vi.json"), "utf8"));
const dialogueEn = JSON.parse(fs.readFileSync(path.join(contentDir, "dialogue.en.json"), "utf8"));
const curatedPlaces = JSON.parse(fs.readFileSync(path.join(contentDir, "curated-places.json"), "utf8"));
const assetManifest = JSON.parse(fs.readFileSync(path.join(publicDir, "assets", "manifest.json"), "utf8"));
const sourcesMarkdown = fs.readFileSync(path.join(contentDir, "sources.md"), "utf8");

console.log("=== ADVERSARIAL STRESS TEST SUITE ===");

let testsPassed = 0;
let testsFailed = 0;

function assertValidationFails(description: string, mutateFn: (input: any) => void, expectedCode: string) {
  // Clone inputs
  const input = {
    locationsVi: JSON.parse(JSON.stringify(locationsVi)),
    locationsEn: JSON.parse(JSON.stringify(locationsEn)),
    dialogueVi: JSON.parse(JSON.stringify(dialogueVi)),
    dialogueEn: JSON.parse(JSON.stringify(dialogueEn)),
    curatedPlaces: JSON.parse(JSON.stringify(curatedPlaces)),
    sourcesMarkdown,
    assetManifest: JSON.parse(JSON.stringify(assetManifest)),
    publicDir,
  };

  mutateFn(input);
  const result = validateContentData(input);

  if (!result.ok && result.issues.some(i => i.code === expectedCode)) {
    console.log(`[PASS] ${description} -> Caught error code: ${expectedCode}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${description} -> Expected code ${expectedCode}, got result ok=${result.ok}, issues:`, result.issues);
    testsFailed++;
  }
}

function assertAssetValidationFails(description: string, mutateFn: (input: any) => void, expectedCode: string) {
  const input = {
    manifest: JSON.parse(JSON.stringify(assetManifest)),
    publicDir,
    sourcesMarkdown,
  };

  mutateFn(input);
  const result = validateAssetManifest(input);

  if (!result.ok && result.issues.some(i => i.code === expectedCode)) {
    console.log(`[PASS] ${description} -> Caught error code: ${expectedCode}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${description} -> Expected code ${expectedCode}, got result ok=${result.ok}, issues:`, result.issues);
    testsFailed++;
  }
}

// 1. Stress test: Food cards < 12
assertValidationFails(
  "Food cards count < 12 (11 cards)",
  (input) => { input.curatedPlaces.cards = input.curatedPlaces.cards.slice(0, 11); },
  "CURATED_PLACES_INCOMPLETE"
);

// 2. Stress test: Missing landmark coverage in food cards
assertValidationFails(
  "Food cards missing landmark representation",
  (input) => {
    input.curatedPlaces.cards = input.curatedPlaces.cards.filter((c: any) => c.landmarkKey !== "ba_na_hills");
  },
  "CURATED_PLACE_LANDMARK_MISSING"
);

// 3. Stress test: Restricted field in food card
assertValidationFails(
  "Food card containing restricted 'rating' field",
  (input) => {
    input.curatedPlaces.cards[0].rating = 4.8;
  },
  "RESTRICTED_PLACE_DATA"
);

// 4. Stress test: Invalid shortDescription word count (< 50 words)
assertValidationFails(
  "Landmark description under 50 words",
  (input) => {
    input.locationsVi.dragon_bridge.shortDescription = "Cầu Rồng là một cây cầu độc đáo.";
  },
  "LOCATION_DESCRIPTION_WORD_COUNT_INVALID"
);

// 5. Stress test: Invalid shortDescription word count (> 80 words)
assertValidationFails(
  "Landmark description over 80 words",
  (input) => {
    input.locationsVi.dragon_bridge.shortDescription = Array(85).fill("từ").join(" ");
  },
  "LOCATION_DESCRIPTION_WORD_COUNT_INVALID"
);

// 6. Stress test: Missing location key
assertValidationFails(
  "Missing location key in locations.vi.json",
  (input) => {
    delete input.locationsVi.ba_na_hills;
  },
  "LOCATION_KEYS_INVALID"
);

// 7. Stress test: Landmark asset marked placeholder=true
assertAssetValidationFails(
  "Landmark asset marked with placeholder: true",
  (input) => {
    const lm = input.manifest.assets.find((a: any) => a.id === "landmark_dragon_bridge");
    if (lm) lm.placeholder = true;
  },
  "LANDMARK_PLACEHOLDER_FORBIDDEN"
);

// 8. Stress test: Landmark asset missing required M1 asset ID
assertAssetValidationFails(
  "Manifest missing landmark_ba_na_hills asset",
  (input) => {
    input.manifest.assets = input.manifest.assets.filter((a: any) => a.id !== "landmark_ba_na_hills");
  },
  "REQUIRED_ASSET_MISSING"
);

console.log(`\nAdversarial Stress Test Results: ${testsPassed} passed, ${testsFailed} failed.`);
if (testsFailed > 0) process.exit(1);
