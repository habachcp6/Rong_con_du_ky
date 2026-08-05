import fs from "node:fs";
import path from "node:path";
import { validateContentData } from "../../scripts/validate-content.ts";
import { validateAssetManifest } from "../../scripts/validate-assets.ts";

console.log("=== EMPIRICAL M5 CHALLENGER TEST HARNESS ===");

const root = path.resolve(".");
const locationsVi = JSON.parse(fs.readFileSync(path.join(root, "content/locations.vi.json"), "utf8"));
const locationsEn = JSON.parse(fs.readFileSync(path.join(root, "content/locations.en.json"), "utf8"));
const dialogueVi = JSON.parse(fs.readFileSync(path.join(root, "content/dialogue.vi.json"), "utf8"));
const dialogueEn = JSON.parse(fs.readFileSync(path.join(root, "content/dialogue.en.json"), "utf8"));
const curatedPlaces = JSON.parse(fs.readFileSync(path.join(root, "content/curated-places.json"), "utf8"));
const sourcesMarkdown = fs.readFileSync(path.join(root, "content/sources.md"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/assets/manifest.json"), "utf8"));
const publicDir = path.join(root, "public");

const contentResult = validateContentData({
  locationsVi,
  locationsEn,
  dialogueVi,
  dialogueEn,
  curatedPlaces,
  sourcesMarkdown,
  assetManifest: manifest,
  publicDir,
});

console.log("Content validation ok:", contentResult.ok);
if (!contentResult.ok) {
  console.error("Content issues:", contentResult.issues);
}

const assetResult = validateAssetManifest({
  manifest,
  publicDir,
  sourcesMarkdown,
});

console.log("Asset validation ok:", assetResult.ok);
if (!assetResult.ok) {
  console.error("Asset issues:", assetResult.issues);
}

console.log("Summary:", contentResult.summary, assetResult.summary);
