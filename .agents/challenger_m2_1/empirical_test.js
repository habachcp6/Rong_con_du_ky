import fs from 'node:fs';
import path from 'node:path';

const LANDMARK_FILES = [
  'dragon-bridge.svg',
  'my-khe.svg',
  'marble-mountains.svg',
  'son-tra.svg',
  'han-river-bridge.svg',
  'linh-ung.svg',
  'cham-museum.svg',
  'non-nuoc.svg',
  'han-market.svg',
  'ba-na-hills.svg',
];

const LANDMARKS_DIR = path.resolve('public/assets/landmarks');
const MANIFEST_PATH = path.resolve('public/assets/manifest.json');
const SOURCES_PATH = path.resolve('content/sources.md');

console.log('=== EMPIRICAL STRESS TEST FOR MILESTONE 2 LANDMARK SVGS ===\n');

// 1. Verify Manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const sources = fs.readFileSync(SOURCES_PATH, 'utf8');

const landmarkAssets = manifest.assets.filter((a) => a.category === 'landmark');

console.log(`Found ${landmarkAssets.length} landmark assets in manifest.json`);

if (landmarkAssets.length !== 10) {
  console.error(`FAIL: Expected 10 landmark assets, found ${landmarkAssets.length}`);
} else {
  console.log('PASS: Exactly 10 landmark assets in manifest.json');
}

// 2. Check each landmark file
let allPassed = true;

for (const file of LANDMARK_FILES) {
  const filePath = path.join(LANDMARKS_DIR, file);
  console.log(`\n--- Inspecting: ${file} ---`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: File does not exist: ${filePath}`);
    allPassed = false;
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const size = fs.statSync(filePath).size;
  console.log(`Size: ${size} bytes`);
  if (size < 1500) {
    console.warn(`WARNING: SVG size is under 1.5KB (${size} bytes)`);
  }
  
  // Check Root SVG Attributes
  const rootMatch = content.match(/<svg\b([^>]*)>/i);
  if (!rootMatch) {
    console.error(`FAIL: No <svg> root tag found in ${file}`);
    allPassed = false;
    continue;
  }
  const rootAttrStr = rootMatch[1];
  
  // Check viewBox
  const viewBoxMatch = rootAttrStr.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
  console.log(`viewBox: ${viewBox}`);
  if (viewBox !== '0 0 320 180') {
    console.error(`FAIL: viewBox must be '0 0 320 180', found '${viewBox}'`);
    allPassed = false;
  }
  
  // Check shape-rendering
  const crispMatch = rootAttrStr.match(/shape-rendering=["']([^"']+)["']/i);
  const crisp = crispMatch ? crispMatch[1] : null;
  console.log(`shape-rendering: ${crisp}`);
  if (crisp !== 'crispEdges') {
    console.error(`FAIL: shape-rendering must be 'crispEdges', found '${crisp}'`);
    allPassed = false;
  }

  // Check data-pixel-art
  const pixelArtMatch = rootAttrStr.match(/data-pixel-art=["']([^"']+)["']/i);
  const pixelArt = pixelArtMatch ? pixelArtMatch[1] : null;
  console.log(`data-pixel-art: ${pixelArt}`);
  if (pixelArt !== 'true') {
    console.error(`FAIL: data-pixel-art must be 'true', found '${pixelArt}'`);
    allPassed = false;
  }

  // Check data-alpha
  const alphaMatch = rootAttrStr.match(/data-alpha=["']([^"']+)["']/i);
  const alpha = alphaMatch ? alphaMatch[1] : null;
  console.log(`data-alpha: ${alpha}`);
  if (alpha !== 'false') {
    console.error(`FAIL: data-alpha must be 'false', found '${alpha}'`);
    allPassed = false;
  }

  // Check forbidden elements
  const hasGradients = /<(linearGradient|radialGradient)\b/i.test(content);
  if (hasGradients) {
    console.error(`FAIL: Contains forbidden gradients!`);
    allPassed = false;
  } else {
    console.log(`Gradients check: CLEAN (none found)`);
  }

  const hasFilters = /<filter\b/i.test(content);
  if (hasFilters) {
    console.error(`FAIL: Contains forbidden filters!`);
    allPassed = false;
  } else {
    console.log(`Filters check: CLEAN (none found)`);
  }

  const hasImages = /<image\b/i.test(content);
  const hasExternalHref = /\b(href|xlink:href)=["']https?:\/\//i.test(content);
  if (hasImages || hasExternalHref) {
    console.error(`FAIL: Contains external images or links!`);
    allPassed = false;
  } else {
    console.log(`Images / External links check: CLEAN (none found)`);
  }

  // Border frame check: color #182433
  const hasBorderFrameColor = content.includes('#182433') || content.includes('#182433'.toLowerCase());
  console.log(`Border frame color (#182433): ${hasBorderFrameColor ? 'FOUND' : 'MISSING'}`);
  if (!hasBorderFrameColor) {
    console.error(`FAIL: Missing border frame color #182433 in ${file}`);
    allPassed = false;
  }

  // Unique Color Palette Count
  // Extract hex colors, rgb colors, named colors
  const hexColors = new Set(content.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
  console.log(`Unique hex colors: ${hexColors.size} (${Array.from(hexColors).join(', ')})`);
  if (hexColors.size > 24) {
    console.error(`FAIL: Palette has ${hexColors.size} colors, max allowed is 24!`);
    allPassed = false;
  } else {
    console.log(`Color count check: PASS (${hexColors.size} <= 24)`);
  }
}

// 3. Manifest association check
console.log('\n=== MANIFEST & ATTRIBUTION AUDIT ===');
for (const landmark of landmarkAssets) {
  console.log(`Asset ID: ${landmark.id}`);
  console.log(`  Path: ${landmark.path}`);
  console.log(`  Placeholder: ${landmark.placeholder}`);
  console.log(`  Attribution ID: ${landmark.attributionId}`);
  
  if (landmark.placeholder !== false) {
    console.error(`FAIL: ${landmark.id} placeholder is not false!`);
    allPassed = false;
  }
  
  if (landmark.width !== 320 || landmark.height !== 180) {
    console.error(`FAIL: ${landmark.id} dimensions are not 320x180!`);
    allPassed = false;
  }
  
  if (!sources.includes(`id: ${landmark.attributionId}`)) {
    console.error(`FAIL: Attribution ID ${landmark.attributionId} not found in content/sources.md!`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n>>> ALL EMPIRICAL CHECKS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
}
