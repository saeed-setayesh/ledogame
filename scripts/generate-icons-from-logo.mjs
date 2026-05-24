#!/usr/bin/env node
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "logo-dedo", "App-0۱.png");
const iconsDir = path.join(root, "public", "icons");

/** Inset ratio per side — larger = more zoomed-out icon (0.14 ≈ 72% logo size). */
const ICON_PADDING = 0.14;

if (!fs.existsSync(src)) {
  console.error("Missing logo:", src);
  process.exit(1);
}

async function iconWithPadding(size, { transparent = false } = {}) {
  const inner = Math.round(size * (1 - ICON_PADDING * 2));
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const buf = await iconWithPadding(size, { transparent: false });
  await sharp(buf).toFile(path.join(iconsDir, name));
  console.log("Wrote", name);
}

const androidRes = path.join(root, "android", "app", "src", "main", "res");
const mipmapSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

for (const [folder, size] of Object.entries(mipmapSizes)) {
  const dir = path.join(androidRes, folder);
  if (!fs.existsSync(dir)) continue;

  const fullIcon = await iconWithPadding(size, { transparent: false });
  await sharp(fullIcon).toFile(path.join(dir, "ic_launcher.png"));
  await sharp(fullIcon).toFile(path.join(dir, "ic_launcher_round.png"));

  const foreground = await iconWithPadding(size, { transparent: true });
  await sharp(foreground).toFile(path.join(dir, "ic_launcher_foreground.png"));

  console.log("Updated", folder);
}
