const fs = require('fs');
const path = require('path');

const dir = 'D:/Hackthon-GG2026/public/assets/landmarks';
const manifestPath = 'D:/Hackthon-GG2026/public/assets/manifest.json';
const locationsViPath = 'D:/Hackthon-GG2026/content/locations.vi.json';
const sourcesPath = 'D:/Hackthon-GG2026/content/sources.md';

let errors = [];
let warnings = [];

// 1. Check max 24 colors per SVG image
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  // Match all hex colors (#fff, #ffffff, etc.)
  const colorMatches = content.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  const uniqueColors = new Set(colorMatches.map(c => c.toLowerCase()));
  console.log(`${file}: ${uniqueColors.size} unique hex colors found:`, Array.from(uniqueColors).join(', '));
  if (uniqueColors.size > 24) {
    warnings.push(`${file} exceeds 24 max colors recommendation (${uniqueColors.size} unique hex colors found)`);
  }
}

// 2. Check XML structure: basic tag matching
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  if (!content.trim().startsWith('<svg') || !content.trim().endsWith('</svg>')) {
    errors.push(`${file}: invalid SVG root tag structure`);
  }
}

// 3. Location assetId parity check
const locationsVi = JSON.parse(fs.readFileSync(locationsViPath, 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

for (const loc of Object.values(locationsVi)) {
  const assetId = loc.assetId;
  const manifestEntry = manifest.assets.find(a => a.id === assetId);
  if (!manifestEntry) {
    errors.push(`Location key '${loc.key}' references assetId '${assetId}' which is NOT in manifest.json`);
  } else {
    if (manifestEntry.path !== loc.authoredImage) {
      errors.push(`Location key '${loc.key}' authoredImage '${loc.authoredImage}' does not match manifest path '${manifestEntry.path}'`);
    }
  }
  
  if (loc.imageAttributionId !== 'asset_landmark_art_01') {
    warnings.push(`Location key '${loc.key}' has imageAttributionId '${loc.imageAttributionId}' instead of 'asset_landmark_art_01'`);
  }
}

// 4. Check sourceId asset_landmark_art_01 in content/sources.md
const sourcesContent = fs.readFileSync(sourcesPath, 'utf-8');
if (!sourcesContent.includes('asset_landmark_art_01')) {
  errors.push('sources.md missing entry for asset_landmark_art_01');
}

console.log('\n--- STRESS TEST SUMMARY ---');
console.log('Errors:', errors);
console.log('Warnings:', warnings);

if (errors.length > 0) {
  process.exit(1);
} else {
  console.log('✅ STRESS TEST COMPLETED');
}
