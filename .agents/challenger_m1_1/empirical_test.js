import fs from "fs";
import path from "path";

const root = "D:\\Hackthon-GG2026";
const viPath = path.join(root, "content", "locations.vi.json");
const enPath = path.join(root, "content", "locations.en.json");
const curatedPath = path.join(root, "content", "curated-places.json");
const sourcesPath = path.join(root, "content", "sources.md");

const viData = JSON.parse(fs.readFileSync(viPath, "utf8"));
const enData = JSON.parse(fs.readFileSync(enPath, "utf8"));
const curatedData = JSON.parse(fs.readFileSync(curatedPath, "utf8"));
const sourcesContent = fs.readFileSync(sourcesPath, "utf8");

const results = {
  keyParity: [],
  textConstraints: [],
  foodCards: [],
  restrictedFields: [],
  sources: [],
};

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

// 1. Key Parity
const viKeys = Object.keys(viData);
const enKeys = Object.keys(enData);

if (JSON.stringify(viKeys) === JSON.stringify(enKeys)) {
  results.keyParity.push({ status: "PASS", message: "VI and EN location keys are identical in list and order." });
} else {
  results.keyParity.push({ status: "FAIL", message: `Key mismatch between VI and EN. VI: ${viKeys.join(",")}, EN: ${enKeys.join(",")}` });
}

if (JSON.stringify(viKeys.sort()) === JSON.stringify(EXPECTED_LANDMARKS.slice().sort())) {
  results.keyParity.push({ status: "PASS", message: "Contains all 10 expected landmark keys." });
} else {
  results.keyParity.push({ status: "FAIL", message: `Keys do not match expected 10 landmark keys. Got: ${viKeys.join(",")}` });
}

// 2. Text Constraints
function wordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

for (const key of viKeys) {
  for (const lang of ["vi", "en"]) {
    const item = lang === "vi" ? viData[key] : enData[key];
    const prefix = `[${lang.toUpperCase()}] ${key}`;

    // shortDescription
    const desc = item.shortDescription || "";
    const descLen = desc.length;
    const descWords = wordCount(desc);
    if (descLen >= 80 && descLen <= 700 && descWords >= 50 && descWords <= 80) {
      results.textConstraints.push({ status: "PASS", message: `${prefix} shortDescription: ${descLen} chars, ${descWords} words (Limit: 80-700 chars, 50-80 words)` });
    } else {
      results.textConstraints.push({ status: "FAIL", message: `${prefix} shortDescription FAIL: ${descLen} chars (limit 80-700), ${descWords} words (limit 50-80)` });
    }

    // funFact
    const ff = item.funFact || "";
    const ffLen = ff.length;
    if (ffLen >= 20 && ffLen <= 300) {
      results.textConstraints.push({ status: "PASS", message: `${prefix} funFact: ${ffLen} chars (Limit: 20-300 chars)` });
    } else {
      results.textConstraints.push({ status: "FAIL", message: `${prefix} funFact FAIL: ${ffLen} chars (limit 20-300)` });
    }

    // visitTip
    const vt = item.visitTip || "";
    const vtLen = vt.length;
    if (vtLen >= 20 && vtLen <= 350) {
      results.textConstraints.push({ status: "PASS", message: `${prefix} visitTip: ${vtLen} chars (Limit: 20-350 chars)` });
    } else {
      results.textConstraints.push({ status: "FAIL", message: `${prefix} visitTip FAIL: ${vtLen} chars (limit 20-350)` });
    }
  }
}

// 3. Food Cards
const cards = curatedData.cards || [];
if (cards.length >= 12) {
  results.foodCards.push({ status: "PASS", message: `Total food cards count: ${cards.length} (>= 12 requirement met)` });
} else {
  results.foodCards.push({ status: "FAIL", message: `Total food cards count: ${cards.length} (< 12 required)` });
}

const foodCardsByLandmark = {};
EXPECTED_LANDMARKS.forEach(k => foodCardsByLandmark[k] = 0);
cards.forEach(c => {
  if (foodCardsByLandmark[c.landmarkKey] !== undefined) {
    foodCardsByLandmark[c.landmarkKey]++;
  } else {
    results.foodCards.push({ status: "FAIL", message: `Food card ${c.id} references unknown landmarkKey '${c.landmarkKey}'` });
  }
});

let allLandmarksHaveFood = true;
for (const k of EXPECTED_LANDMARKS) {
  if (foodCardsByLandmark[k] >= 1) {
    results.foodCards.push({ status: "PASS", message: `Landmark '${k}' has ${foodCardsByLandmark[k]} food card(s).` });
  } else {
    allLandmarksHaveFood = false;
    results.foodCards.push({ status: "FAIL", message: `Landmark '${k}' has NO food cards!` });
  }
}

// 4. Restricted Google Places Fields Check
const RESTRICTED = ["rating", "reviews", "openingHours", "openNow", "photos", "photoUrl", "userRatingCount"];

function checkRestricted(obj, pathStr) {
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => checkRestricted(item, `${pathStr}[${i}]`));
  } else if (typeof obj === "object" && obj !== null) {
    for (const [k, v] of Object.entries(obj)) {
      if (RESTRICTED.includes(k)) {
        results.restrictedFields.push({ status: "FAIL", message: `Restricted field '${k}' found at ${pathStr}.${k}` });
      }
      checkRestricted(v, `${pathStr}.${k}`);
    }
  }
}

checkRestricted(curatedData, "curated-places");
if (results.restrictedFields.length === 0) {
  results.restrictedFields.push({ status: "PASS", message: "No restricted Google Places fields found in curated-places.json." });
}

// 5. Sources Check
const declaredSources = new Set();
const matches = sourcesContent.matchAll(/^## `([a-z][a-z0-9_]*)`\s*$/gmu);
for (const m of matches) {
  declaredSources.add(m[1]);
}

const referencedSources = new Set();
for (const k of viKeys) {
  (viData[k].sourceIds || []).forEach(s => referencedSources.add(s));
  (enData[k].sourceIds || []).forEach(s => referencedSources.add(s));
}
cards.forEach(c => {
  (c.sourceIds || []).forEach(s => referencedSources.add(s));
});

let missingSources = 0;
for (const src of referencedSources) {
  if (declaredSources.has(src)) {
    results.sources.push({ status: "PASS", message: `Source ID '${src}' exists in content/sources.md.` });
  } else {
    missingSources++;
    results.sources.push({ status: "FAIL", message: `Source ID '${src}' referenced in content but missing in content/sources.md!` });
  }
}

console.log("=== EMPIRICAL TEST RESULTS ===");
console.log(JSON.stringify(results, null, 2));
