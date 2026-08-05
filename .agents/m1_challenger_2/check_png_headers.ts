import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function checkPng(filePath: string, expectedWidth: number, expectedHeight: number) {
  const buffer = fs.readFileSync(filePath);
  const header = buffer.subarray(0, 8);
  const isPng = header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let width = 0;
  let height = 0;
  if (buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "IHDR") {
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  }
  const pass = isPng && width === expectedWidth && height === expectedHeight;
  console.log(
    `${pass ? "✅" : "❌"} ${path.relative(projectRoot, filePath)}: ${width}x${height} (expected ${expectedWidth}x${expectedHeight}, PNG header: ${isPng})`
  );
  return pass;
}

console.log("=== CHECKING ALL PNG ASSET HEADERS & DIMENSIONS ===");

let allOk = true;

// 1. Map background
allOk = checkPng(path.join(projectRoot, "public/assets/map/overworld-night.png"), 1600, 960) && allOk;

// 2. Postcards
const landmarksDir = path.join(projectRoot, "public/assets/landmarks");
const postcards = fs.readdirSync(landmarksDir).filter((f) => f.endsWith(".png"));
for (const p of postcards) {
  allOk = checkPng(path.join(landmarksDir, p), 320, 180) && allOk;
}

// 3. Landmark icons
const iconsDir = path.join(projectRoot, "public/assets/landmark-icons");
const icons = fs.readdirSync(iconsDir).filter((f) => f.endsWith(".png"));
for (const ic of icons) {
  allOk = checkPng(path.join(iconsDir, ic), 48, 48) && allOk;
}

console.log(`\nResult: ${allOk ? "ALL ASSET HEADERS & DIMENSIONS PASS" : "SOME ASSETS FAILED"}`);
