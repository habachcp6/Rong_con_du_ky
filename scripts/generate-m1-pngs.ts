import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const landmarks = [
  "dragon-bridge",
  "my-khe",
  "marble-mountains",
  "son-tra",
  "han-river-bridge",
  "linh-ung",
  "cham-museum",
  "non-nuoc",
  "han-market",
  "ba-na-hills",
];

const icons = [
  "dragon-bridge",
  "my-khe-beach",
  "marble-mountains",
  "son-tra-peninsula",
  "han-river-bridge",
  "linh-ung-son-tra",
  "cham-museum",
  "non-nuoc-stone-village",
  "han-market",
  "ba-na-hills",
];

async function generate() {
  const publicDir = path.resolve("public");

  // 1. Postcards (320x180)
  for (const name of landmarks) {
    const svgPath = path.join(publicDir, "assets/landmarks", `${name}.svg`);
    const pngPath = path.join(publicDir, "assets/landmarks", `${name}.png`);
    if (fs.existsSync(svgPath)) {
      await sharp(svgPath).resize(320, 180).png().toFile(pngPath);
    } else {
      await sharp({
        create: {
          width: 320,
          height: 180,
          channels: 3,
          background: { r: 30, g: 40, b: 60 },
        },
      })
        .png()
        .toFile(pngPath);
    }
  }

  // 2. Map icons (48x48)
  for (const name of icons) {
    const svgPath = path.join(
      publicDir,
      "assets/landmark-icons",
      `${name}.svg`,
    );
    const pngPath = path.join(
      publicDir,
      "assets/landmark-icons",
      `${name}.png`,
    );
    if (fs.existsSync(svgPath)) {
      await sharp(svgPath).resize(48, 48).png().toFile(pngPath);
    } else {
      await sharp({
        create: {
          width: 48,
          height: 48,
          channels: 4,
          background: { r: 50, g: 60, b: 70, alpha: 0.8 },
        },
      })
        .png()
        .toFile(pngPath);
    }
  }

  // 3. Map overworld night (1600x960)
  const mapDir = path.join(publicDir, "assets/map");
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  }
  const nightMapPath = path.join(mapDir, "overworld-night.png");
  await sharp({
    create: {
      width: 1600,
      height: 960,
      channels: 3,
      background: { r: 15, g: 23, b: 42 },
    },
  })
    .png()
    .toFile(nightMapPath);
  console.log("PNG generation complete!");
}

generate().catch(console.error);
