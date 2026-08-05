import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('public/assets/manifest.json');
const locViPath = path.resolve('content/locations.vi.json');
const locEnPath = path.resolve('content/locations.en.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const locVi = JSON.parse(fs.readFileSync(locViPath, 'utf8'));
const locEn = JSON.parse(fs.readFileSync(locEnPath, 'utf8'));

console.log('=== CROSS-REFERENCE INTEGRATION AUDIT ===');

const manifestLandmarks = new Map(
  manifest.assets
    .filter((a: any) => a.category === 'landmark')
    .map((a: any) => [a.id, a])
);

console.log(`Manifest landmarks count: ${manifestLandmarks.size}`);

for (const loc of Object.values(locVi) as any[]) {
  console.log(`\nLocation key: ${loc.key}`);
  console.log(`  authoredImage: ${loc.authoredImage}`);
  console.log(`  assetId: ${loc.assetId}`);

  // Check file existence
  const localPath = path.resolve('public', '.' + loc.authoredImage);
  if (!fs.existsSync(localPath)) {
    console.error(`  FAIL: Image file does not exist: ${localPath}`);
  } else {
    console.log(`  File exists: OK`);
  }

  // Check manifest entry
  const manifestEntry = manifestLandmarks.get(loc.assetId);
  if (!manifestEntry) {
    console.error(`  FAIL: assetId '${loc.assetId}' not found in manifest!`);
  } else {
    console.log(`  Manifest entry found: ${manifestEntry.path}`);
    if (manifestEntry.path !== loc.authoredImage) {
      console.error(`  FAIL: Path mismatch! Manifest has '${manifestEntry.path}', location has '${loc.authoredImage}'`);
    }
  }
}
