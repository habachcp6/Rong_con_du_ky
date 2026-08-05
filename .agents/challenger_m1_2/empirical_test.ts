import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:\\Hackthon-GG2026';
const locViPath = path.join(projectRoot, 'content', 'locations.vi.json');
const locEnPath = path.join(projectRoot, 'content', 'locations.en.json');
const placesPath = path.join(projectRoot, 'content', 'curated-places.json');
const sourcesPath = path.join(projectRoot, 'content', 'sources.md');

const locVi = JSON.parse(fs.readFileSync(locViPath, 'utf8'));
const locEn = JSON.parse(fs.readFileSync(locEnPath, 'utf8'));
const places = JSON.parse(fs.readFileSync(placesPath, 'utf8'));
const sourcesMd = fs.readFileSync(sourcesPath, 'utf8');

const issues: string[] = [];
const log: string[] = [];

log.push("=== EMPIRICAL CONTENT STRESS-TEST ===");

// 1. Check Key Parity & Order
const viKeys = Object.keys(locVi);
const enKeys = Object.keys(locEn);

log.push(`VI keys count: ${viKeys.length}`);
log.push(`EN keys count: ${enKeys.length}`);

if (viKeys.length !== 10) {
  issues.push(`VI keys count is ${viKeys.length}, expected 10`);
}
if (enKeys.length !== 10) {
  issues.push(`EN keys count is ${enKeys.length}, expected 10`);
}

if (JSON.stringify(viKeys) !== JSON.stringify(enKeys)) {
  issues.push(`Key parity mismatch or order mismatch between VI and EN`);
  log.push(`VI: ${JSON.stringify(viKeys)}`);
  log.push(`EN: ${JSON.stringify(enKeys)}`);
} else {
  log.push(`✅ Key parity & order match perfectly for all 10 keys: ${viKeys.join(', ')}`);
}

// Function to count words
function wordCount(str: string): number {
  return str.trim().split(/\s+/u).filter(Boolean).length;
}

// 2. Check Word Count and Character Limits
for (const key of viKeys) {
  const itemVi = locVi[key];
  const itemEn = locEn[key];

  log.push(`\n--- Landmark: ${key} ---`);

  for (const [lang, item] of [['VI', itemVi], ['EN', itemEn]] as const) {
    if (!item) {
      issues.push(`Landmark ${key} missing in ${lang}`);
      continue;
    }

    // shortDescription: 80-700 chars, 50-80 words
    const sdLen = item.shortDescription?.length ?? 0;
    const sdWords = wordCount(item.shortDescription ?? '');
    log.push(`  [${lang}] shortDescription: ${sdLen} chars, ${sdWords} words`);

    if (sdLen < 80 || sdLen > 700) {
      issues.push(`[${lang}] ${key}.shortDescription char length ${sdLen} outside [80, 700]`);
    }
    if (sdWords < 50 || sdWords > 80) {
      issues.push(`[${lang}] ${key}.shortDescription word count ${sdWords} outside [50, 80]`);
    }

    // funFact: 20-300 chars
    const ffLen = item.funFact?.length ?? 0;
    log.push(`  [${lang}] funFact: ${ffLen} chars`);
    if (ffLen < 20 || ffLen > 300) {
      issues.push(`[${lang}] ${key}.funFact char length ${ffLen} outside [20, 300]`);
    }

    // visitTip: 20-350 chars
    const vtLen = item.visitTip?.length ?? 0;
    log.push(`  [${lang}] visitTip: ${vtLen} chars`);
    if (vtLen < 20 || vtLen > 350) {
      issues.push(`[${lang}] ${key}.visitTip char length ${vtLen} outside [20, 350]`);
    }
  }
}

// 3. Check Curated Places (Food Cards)
log.push(`\n--- Curated Places ---`);
const cards = places.cards || [];
log.push(`Total food cards: ${cards.length}`);

if (cards.length < 12) {
  issues.push(`Food cards count ${cards.length} is less than 12`);
} else {
  log.push(`✅ Total food cards: ${cards.length} (>= 12 requirement met)`);
}

// Check coverage per landmark
const cardCountsPerLandmark: Record<string, number> = {};
for (const key of viKeys) {
  cardCountsPerLandmark[key] = 0;
}

const restrictedFields = ['rating', 'reviews', 'openingHours', 'openNow', 'photos', 'photoUrl'];
const foundRestricted: string[] = [];

const priceRanges = new Set<string>();
const dietaryTypes = new Set<string>();

for (const [idx, card] of cards.entries()) {
  if (card.landmarkKey) {
    cardCountsPerLandmark[card.landmarkKey] = (cardCountsPerLandmark[card.landmarkKey] || 0) + 1;
  }
  if (card.priceRange) priceRanges.add(card.priceRange);
  if (card.dietary) dietaryTypes.add(card.dietary);

  // Check restricted fields recursively
  function scanRestricted(obj: any, pathStr: string) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (restrictedFields.includes(k)) {
        foundRestricted.push(`Card #${idx} (${card.id}): field '${k}' found at ${pathStr}.${k}`);
      }
      scanRestricted(obj[k], `${pathStr}.${k}`);
    }
  }
  scanRestricted(card, `card[${idx}]`);
}

log.push("\nFood Card Counts per Landmark:");
for (const key of viKeys) {
  const count = cardCountsPerLandmark[key] || 0;
  log.push(`  ${key}: ${count} card(s)`);
  if (count < 1) {
    issues.push(`Landmark ${key} has 0 food cards in curated-places.json`);
  }
}

log.push(`Price ranges present: ${Array.from(priceRanges).join(', ')}`);
log.push(`Dietary options present: ${Array.from(dietaryTypes).join(', ')}`);

// 4. Restricted Fields check
if (foundRestricted.length > 0) {
  log.push(`❌ Found restricted fields:`);
  for (const r of foundRestricted) {
    log.push(`  - ${r}`);
    issues.push(r);
  }
} else {
  log.push(`✅ Zero restricted Google Places fields found in curated-places.json`);
}

// 5. Source IDs check
log.push(`\n--- Sources Check ---`);
const sourceIdsInMd = new Set<string>();
for (const match of sourcesMd.matchAll(/^## `([a-z][a-z0-9_]*)`\s*$/gmu)) {
  sourceIdsInMd.add(match[1]);
}
log.push(`Total source entries in sources.md: ${sourceIdsInMd.size}`);

// Verify all location sourceIds
for (const key of viKeys) {
  for (const sId of locVi[key].sourceIds || []) {
    if (!sourceIdsInMd.has(sId)) {
      issues.push(`Location ${key} (VI) references missing source ID: ${sId}`);
    }
  }
  for (const sId of locEn[key].sourceIds || []) {
    if (!sourceIdsInMd.has(sId)) {
      issues.push(`Location ${key} (EN) references missing source ID: ${sId}`);
    }
  }
}

for (const card of cards) {
  for (const sId of card.sourceIds || []) {
    if (!sourceIdsInMd.has(sId)) {
      issues.push(`Food card ${card.id} references missing source ID: ${sId}`);
    }
  }
}

log.push(`\n=== SUMMARY ===`);
if (issues.length === 0) {
  log.push(`🎉 ALL EMPIRICAL CONTENT CHECKS PASSED PERFECTLY!`);
} else {
  log.push(`❌ ${issues.length} ISSUE(S) FOUND:`);
  for (const issue of issues) {
    log.push(`  - ${issue}`);
  }
}

console.log(log.join('\n'));
