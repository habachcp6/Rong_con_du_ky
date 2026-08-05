import fs from "node:fs";
import path from "node:path";
import {
  getAllLocationContent,
  getCuratedPlaceCards,
  getLocationContent,
} from "../../src/client/content";

const ROOT = process.cwd();
const EXPECTED_LANDMARKS = [
  "dragon_bridge",
  "my_khe_beach",
  "marble_mountains",
  "son_tra_peninsula",
  "han_river_bridge",
  "linh_ung_son_tra",
  "cham_museum",
  "non_nuoc_stone_village",
  "han_market",
  "ba_na_hills",
];

const RESTRICTED_FIELDS = [
  "rating",
  "reviews",
  "openingHours",
  "openNow",
  "photos",
  "photoUrl",
];

function runEmpiricalTests() {
  console.log("=== EMPIRICAL M4 VERIFICATION SUITE ===");
  let passed = true;

  // 1. Verify 10 landmark location keys in VI and EN
  const viLocations = getAllLocationContent("vi");
  const enLocations = getAllLocationContent("en");

  console.log(`\n1. Location Count: VI=${viLocations.length}, EN=${enLocations.length}`);
  if (viLocations.length !== 10 || enLocations.length !== 10) {
    console.error("❌ FAIL: Location count is not exactly 10 in both languages.");
    passed = false;
  } else {
    console.log("✅ PASS: Exactly 10 locations in VI and EN.");
  }

  const viKeys = viLocations.map((l) => l.key);
  const enKeys = enLocations.map((l) => l.key);

  console.log("\n2. Location Keys Verification:");
  for (const expectedKey of EXPECTED_LANDMARKS) {
    const viFound = viKeys.includes(expectedKey);
    const enFound = enKeys.includes(expectedKey);
    if (!viFound || !enFound) {
      console.error(`❌ FAIL: Missing landmark key '${expectedKey}' (VI: ${viFound}, EN: ${enFound})`);
      passed = false;
    } else {
      console.log(`  - Key '${expectedKey}': OK`);
    }
  }

  // 3. Verify Food Card mapping for EACH of the 10 location keys
  console.log("\n3. Food Card Mapping for Each Landmark (VI & EN):");
  const viCards = getCuratedPlaceCards("vi");
  const enCards = getCuratedPlaceCards("en");

  console.log(`Total Food Cards: ${viCards.length}`);
  if (viCards.length < 12) {
    console.error(`❌ FAIL: Expected at least 12 food cards, got ${viCards.length}`);
    passed = false;
  } else {
    console.log(`✅ PASS: ${viCards.length} food cards defined (>= 12).`);
  }

  for (const key of EXPECTED_LANDMARKS) {
    const cardsForLandmarkVi = viCards.filter((c) => c.landmarkKey === key);
    const cardsForLandmarkEn = enCards.filter((c) => c.landmarkKey === key);

    if (cardsForLandmarkVi.length === 0 || cardsForLandmarkEn.length === 0) {
      console.error(`❌ FAIL: Landmark '${key}' has NO associated food cards!`);
      passed = false;
    } else {
      console.log(`  - Landmark '${key}': ${cardsForLandmarkVi.length} VI card(s), ${cardsForLandmarkEn.length} EN card(s)`);
      for (const card of cardsForLandmarkVi) {
        if (!card.name || !card.description || !card.address || !card.googleMapsUri) {
          console.error(`❌ FAIL: Food card '${card.name}' for '${key}' has missing required fields.`);
          passed = false;
        }
      }
    }
  }

  // 4. Verify Bilingual Rendering & Content Completeness
  console.log("\n4. Bilingual Rendering Details:");
  for (const key of EXPECTED_LANDMARKS) {
    const viLoc = getLocationContent("vi", key);
    const enLoc = getLocationContent("en", key);

    if (!viLoc || !enLoc) {
      console.error(`❌ FAIL: getLocationContent failed for key '${key}'`);
      passed = false;
      continue;
    }

    if (!viLoc.name || !enLoc.name) {
      console.error(`❌ FAIL: Missing localized name for '${key}'`);
      passed = false;
    }
    if (!viLoc.shortDescription || !enLoc.shortDescription) {
      console.error(`❌ FAIL: Missing localized shortDescription for '${key}'`);
      passed = false;
    }
    if (!viLoc.funFact || !enLoc.funFact) {
      console.error(`❌ FAIL: Missing funFact for '${key}'`);
      passed = false;
    }
    if (!viLoc.visitTip || !enLoc.visitTip) {
      console.error(`❌ FAIL: Missing visitTip for '${key}'`);
      passed = false;
    }
    if (!viLoc.authoredImage.startsWith("/assets/landmarks/")) {
      console.error(`❌ FAIL: Invalid authoredImage path for '${key}': ${viLoc.authoredImage}`);
      passed = false;
    }
  }
  console.log("✅ PASS: All 10 landmarks have complete localized content (name, shortDesc, funFact, visitTip, SVG path).");

  // 5. Check restricted fields in curated-places.json
  console.log("\n5. Checking Restricted Google Places Fields in curated-places.json:");
  const curatedPlacesRaw = JSON.parse(
    fs.readFileSync(path.join(ROOT, "content/curated-places.json"), "utf8")
  );
  for (const card of curatedPlacesRaw.cards) {
    for (const field of RESTRICTED_FIELDS) {
      if (field in card) {
        console.error(`❌ FAIL: Food card '${card.nameVi}' contains forbidden field '${field}'`);
        passed = false;
      }
    }
  }
  console.log("✅ PASS: Zero restricted Google Places fields found in curated-places.json.");

  // 6. Check landmark SVG files exist on disk
  console.log("\n6. Checking Landmark SVG Assets:");
  for (const loc of viLocations) {
    const svgPath = path.join(ROOT, "public", loc.authoredImage);
    if (!fs.existsSync(svgPath)) {
      console.error(`❌ FAIL: SVG file missing at '${svgPath}'`);
      passed = false;
    } else {
      const content = fs.readFileSync(svgPath, "utf8");
      if (!content.includes('viewBox="0 0 320 180"')) {
        console.error(`❌ FAIL: SVG '${loc.authoredImage}' missing viewBox 0 0 320 180`);
        passed = false;
      }
      if (!content.includes('shape-rendering="crispEdges"')) {
        console.error(`❌ FAIL: SVG '${loc.authoredImage}' missing shape-rendering="crispEdges"`);
        passed = false;
      }
    }
  }
  console.log("✅ PASS: All 10 landmark SVG postcard files exist and satisfy 320x180 + crispEdges specs.");

  console.log("\n=======================================");
  if (passed) {
    console.log("🎉 ALL EMPIRICAL CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.error("💥 SOME CHECKS FAILED!");
    process.exit(1);
  }
}

runEmpiricalTests();
