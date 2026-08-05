const fs = require('fs');
const path = require('path');

const dir = 'D:/Hackthon-GG2026/public/assets/landmarks';
const manifestPath = 'D:/Hackthon-GG2026/public/assets/manifest.json';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
console.log('Found landmark SVG files:', files.length);

const requiredFiles = [
  'dragon-bridge.svg', 'my-khe.svg', 'marble-mountains.svg', 'son-tra.svg',
  'han-river-bridge.svg', 'linh-ung.svg', 'cham-museum.svg', 'non-nuoc.svg',
  'han-market.svg', 'ba-na-hills.svg'
];

let errors = [];

for (const req of requiredFiles) {
  if (!files.includes(req)) {
    errors.push('Missing file: ' + req);
    continue;
  }
  const content = fs.readFileSync(path.join(dir, req), 'utf-8');
  
  if (!content.includes('viewBox="0 0 320 180"')) {
    errors.push(req + ': missing/invalid viewBox="0 0 320 180"');
  }
  if (!content.includes('shape-rendering="crispEdges"')) {
    errors.push(req + ': missing shape-rendering="crispEdges"');
  }
  if (!content.includes('data-pixel-art="true"')) {
    errors.push(req + ': missing data-pixel-art="true"');
  }
  if (!content.includes('data-alpha="false"')) {
    errors.push(req + ': missing data-alpha="false"');
  }
  if (content.includes('linearGradient') || content.includes('radialGradient')) {
    errors.push(req + ': contains forbidden gradient');
  }
  if (content.includes('<filter') || content.includes('filter=')) {
    errors.push(req + ': contains forbidden filter');
  }
  if (content.includes('<image') || content.includes('xlink:href') || content.includes('href=')) {
    errors.push(req + ': contains forbidden image/external link');
  }
  if (!content.includes('#182433')) {
    errors.push(req + ': missing #182433 border frame color');
  }
  
  const size = fs.statSync(path.join(dir, req)).size;
  console.log(`${req}: size = ${size} bytes`);
  if (size < 1000) {
    errors.push(req + ': file size too small (' + size + ' bytes)');
  }
}

// Check Manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const landmarksInManifest = manifest.assets.filter(a => a.category === 'landmark');

console.log('Landmarks in manifest.json:', landmarksInManifest.length);

const expectedAssetIds = [
  'landmark_dragon_bridge',
  'landmark_my_khe_beach',
  'landmark_marble_mountains',
  'landmark_son_tra_peninsula',
  'landmark_han_river_bridge',
  'landmark_linh_ung_son_tra',
  'landmark_cham_museum',
  'landmark_non_nuoc_stone_village',
  'landmark_han_market',
  'landmark_ba_na_hills'
];

for (const assetId of expectedAssetIds) {
  const item = landmarksInManifest.find(a => a.id === assetId);
  if (!item) {
    errors.push(`Manifest missing asset: ${assetId}`);
    continue;
  }
  if (item.placeholder !== false) {
    errors.push(`Manifest asset ${assetId} placeholder should be false, got ${item.placeholder}`);
  }
  if (item.width !== 320 || item.height !== 180) {
    errors.push(`Manifest asset ${assetId} dimensions should be 320x180, got ${item.width}x${item.height}`);
  }
  if (item.attributionId !== 'asset_landmark_art_01') {
    errors.push(`Manifest asset ${assetId} attributionId should be asset_landmark_art_01, got ${item.attributionId}`);
  }
  
  // Verify path on disk exists
  const diskPath = path.join('D:/Hackthon-GG2026/public', item.path);
  if (!fs.existsSync(diskPath)) {
    errors.push(`Manifest path for ${assetId} does not exist on disk: ${diskPath}`);
  }
}

if (errors.length === 0) {
  console.log('✅ ALL 10 SVGS AND MANIFEST CHECKS PASSED EMPIRICALLY!');
} else {
  console.error('❌ ERRORS FOUND:', errors);
  process.exit(1);
}
