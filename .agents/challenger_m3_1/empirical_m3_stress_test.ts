import {
  DISCOVERABLE_INTERACTABLES,
  QUEST_INTERACTABLES,
  WORLD_COLLIDERS,
  WORLD_BOUNDS,
  getDiscoverableInteractableCopy,
  type DiscoverableInteractable,
  type QuestInteractable,
  type WorldRectangle
} from "../../src/client/game/world.js";

console.log("=================================================");
console.log("M3 EMPIRICAL STRESS TEST SUITE (Phaser Physics Model)");
console.log("=================================================\n");

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

// 1. POI Count and Distinct Keys
console.log("--- 1. POI Count and Distinct Keys ---");
assert(DISCOVERABLE_INTERACTABLES.length === 6, "Total discoverable POIs count is 6", `Found ${DISCOVERABLE_INTERACTABLES.length}`);

const locationKeys = DISCOVERABLE_INTERACTABLES.map(p => p.locationKey);
const uniqueKeys = new Set(locationKeys);
assert(uniqueKeys.size === 6, "All 6 POIs have unique locationKeys", `Keys: ${Array.from(uniqueKeys).join(", ")}`);

const expectedKeys = [
  "han_river_bridge",
  "linh_ung_son_tra",
  "cham_museum",
  "non_nuoc_stone_village",
  "han_market",
  "ba_na_hills",
];
const missingKeys = expectedKeys.filter(k => !uniqueKeys.has(k));
assert(missingKeys.length === 0, "All 6 expected landmark keys are present", missingKeys.length > 0 ? `Missing: ${missingKeys.join(", ")}` : "All present");

// 2. Coordinate Bounds Checks
console.log("\n--- 2. POI Bounds Checks ---");
for (const poi of DISCOVERABLE_INTERACTABLES) {
  const inCenterBounds = poi.x >= 0 && poi.x <= WORLD_BOUNDS.width && poi.y >= 0 && poi.y <= WORLD_BOUNDS.height;
  assert(inCenterBounds, `POI ${poi.id} center (${poi.x}, ${poi.y}) within world bounds (${WORLD_BOUNDS.width}x${WORLD_BOUNDS.height})`);

  const radius = poi.interactionRadius;
  const inRadiusBounds = (poi.x - radius >= 0) && (poi.x + radius <= WORLD_BOUNDS.width) &&
                         (poi.y - radius >= 0) && (poi.y + radius <= WORLD_BOUNDS.height);
  assert(inRadiusBounds, `POI ${poi.id} interaction circle (radius=${radius}) strictly within world bounds`);
}

// 3. Pairwise Distance Checks (POIs vs POIs)
console.log("\n--- 3. Pairwise Distance: POIs vs POIs ---");
const MIN_POI_POI_DIST = 50;
let minPoiPoiDist = Infinity;
let closestPoiPair = "";

for (let i = 0; i < DISCOVERABLE_INTERACTABLES.length; i++) {
  for (let j = i + 1; j < DISCOVERABLE_INTERACTABLES.length; j++) {
    const p1 = DISCOVERABLE_INTERACTABLES[i];
    const p2 = DISCOVERABLE_INTERACTABLES[j];
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (dist < minPoiPoiDist) {
      minPoiPoiDist = dist;
      closestPoiPair = `${p1.id} <-> ${p2.id}`;
    }
  }
}
assert(minPoiPoiDist >= MIN_POI_POI_DIST, `Min POI-POI distance >= ${MIN_POI_POI_DIST}px`, `Closest: ${closestPoiPair} = ${minPoiPoiDist.toFixed(2)}px`);

// 4. Pairwise Distance Checks (POIs vs Quest NPCs)
console.log("\n--- 4. Pairwise Distance: POIs vs Quest NPCs ---");
const MIN_POI_NPC_DIST = 50;
let minPoiNpcDist = Infinity;
let closestPoiNpcPair = "";

for (const poi of DISCOVERABLE_INTERACTABLES) {
  for (const npc of QUEST_INTERACTABLES) {
    const dist = Math.hypot(poi.x - npc.x, poi.y - npc.y);
    if (dist < minPoiNpcDist) {
      minPoiNpcDist = dist;
      closestPoiNpcPair = `${poi.id} <-> ${npc.id}`;
    }
  }
}
assert(minPoiNpcDist >= MIN_POI_NPC_DIST, `Min POI-NPC distance >= ${MIN_POI_NPC_DIST}px`, `Closest: ${closestPoiNpcPair} = ${minPoiNpcDist.toFixed(2)}px`);

// 5. Distance & Collision Checks: POIs vs Colliders (Phaser Arcade static body center-origin)
console.log("\n--- 5. POIs vs Colliders Collision & Distance Checks (Phaser Center Origin) ---");

function pointToCenterOriginRectDistance(px: number, py: number, rect: WorldRectangle) {
  const minX = rect.x - rect.width / 2;
  const maxX = rect.x + rect.width / 2;
  const minY = rect.y - rect.height / 2;
  const maxY = rect.y + rect.height / 2;

  const dx = Math.max(minX - px, 0, px - maxX);
  const dy = Math.max(minY - py, 0, py - maxY);
  const isInside = px >= minX && px <= maxX && py >= minY && py <= maxY;
  const distance = Math.hypot(dx, dy);
  return { distance, isInside, bounds: { minX, maxX, minY, maxY } };
}

for (const poi of DISCOVERABLE_INTERACTABLES) {
  for (const collider of WORLD_COLLIDERS) {
    const res = pointToCenterOriginRectDistance(poi.x, poi.y, collider);
    assert(!res.isInside, `POI ${poi.id} (${poi.x},${poi.y}) not inside collider ${collider.id} box [${res.bounds.minX},${res.bounds.maxX}] x [${res.bounds.minY},${res.bounds.maxY}]`);
    assert(res.distance >= poi.interactionRadius, `POI ${poi.id} is clear of collider ${collider.id} beyond interaction radius (${res.distance.toFixed(2)}px vs radius ${poi.interactionRadius}px)`);
  }
}

// 6. Test getDiscoverableInteractableCopy (VI and EN)
console.log("\n--- 6. Test getDiscoverableInteractableCopy (Bilingual) ---");

for (const poi of DISCOVERABLE_INTERACTABLES) {
  const viCopy = getDiscoverableInteractableCopy(poi, "vi");
  assert(viCopy.name === poi.nameVi, `POI ${poi.id} VI name matches nameVi`, `Got "${viCopy.name}"`);
  assert(viCopy.label.includes(poi.nameVi), `POI ${poi.id} VI label contains nameVi`, `Label: "${viCopy.label}"`);
  assert(viCopy.label.includes("Bấm E / Chạm để xem..."), `POI ${poi.id} VI label contains correct VI action hint`);

  const enCopy = getDiscoverableInteractableCopy(poi, "en");
  assert(enCopy.name === poi.nameEn, `POI ${poi.id} EN name matches nameEn`, `Got "${enCopy.name}"`);
  assert(enCopy.label.includes(poi.nameEn), `POI ${poi.id} EN label contains nameEn`, `Label: "${enCopy.label}"`);
  assert(enCopy.label.includes("Press E / Tap to view..."), `POI ${poi.id} EN label contains correct EN action hint`);
}

// 7. Player Starting Position Check
console.log("\n--- 7. Player Start Position Check ---");
const startX = WORLD_BOUNDS.playerStart.x;
const startY = WORLD_BOUNDS.playerStart.y;
console.log(`Player start position: (${startX}, ${startY})`);

for (const collider of WORLD_COLLIDERS) {
  const res = pointToCenterOriginRectDistance(startX, startY, collider);
  assert(!res.isInside, `Player start (${startX},${startY}) is not inside collider ${collider.id}`);
}

for (const poi of DISCOVERABLE_INTERACTABLES) {
  const dist = Math.hypot(startX - poi.x, startY - poi.y);
  assert(dist > poi.interactionRadius, `Player start is outside initial interaction radius of POI ${poi.id}`, `Dist: ${dist.toFixed(2)}px vs radius ${poi.interactionRadius}px`);
}

console.log("\n=================================================");
console.log(`STRESS TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log("=================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
