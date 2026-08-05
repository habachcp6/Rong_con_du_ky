const fs = require('fs');
const path = require('path');

const landmarksDir = path.resolve(__dirname, '../../public/assets/landmarks');

function extractAllColorFormats(svg) {
  // Check for hex, rgb, rgba, hsl, hsla, named colors
  const hexes = svg.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgbs = svg.match(/rgba?\([^)]+\)/gi) || [];
  const hsls = svg.match(/hsla?\([^)]+\)/gi) || [];
  
  const allHexes = new Set(hexes.map(c => c.toLowerCase()));
  return {
    hexes: allHexes,
    rgbs: new Set(rgbs),
    hsls: new Set(hsls),
    totalHexCount: allHexes.size
  };
}

console.log("=== EMPIRICAL TEST: Landmark SVG Color Palette Analysis ===");

const files = fs.readdirSync(landmarksDir).filter(f => f.endsWith('.svg'));
console.log(`Found ${files.length} SVG files in ${landmarksDir}\n`);

let failedCount = 0;
const results = {};

for (const file of files) {
  const filePath = path.join(landmarksDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const colorData = extractAllColorFormats(content);
  const hexCount = colorData.totalHexCount;
  
  results[file] = hexCount;
  const status = hexCount <= 24 ? "PASS" : "FAIL";
  if (hexCount > 24) failedCount++;
  
  console.log(`File: ${file.padEnd(25)} | Colors: ${hexCount.toString().padStart(2)} / 24 | Result: [${status}]`);
  if (colorData.rgbs.size > 0) {
    console.log(`   Warning: Non-hex RGB colors found: ${Array.from(colorData.rgbs).join(', ')}`);
  }
  if (colorData.hsls.size > 0) {
    console.log(`   Warning: Non-hex HSL colors found: ${Array.from(colorData.hsls).join(', ')}`);
  }
}

console.log("\nSummary of Color Counts:");
console.table(results);

if (files.length !== 10) {
  console.error(`❌ Expected 10 SVG files, but found ${files.length}`);
  process.exit(1);
}

if (failedCount > 0) {
  console.error(`❌ ${failedCount} SVG file(s) exceeded the maximum limit of 24 colors!`);
  process.exit(1);
} else {
  console.log("✅ All 10 SVG files passed the <= 24 unique colors requirement!");
}
