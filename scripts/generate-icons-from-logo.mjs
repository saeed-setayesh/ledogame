#!/usr/bin/env node
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "logo-dedo", "App-0۱.png");
const iconsDir = path.join(root, "public", "icons");

if (!fs.existsSync(src)) {
  console.error("Missing logo:", src);
  process.exit(1);
}

fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(src).resize(size, size).png().toFile(path.join(iconsDir, name));
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
  for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    await sharp(src).resize(size, size).png().toFile(path.join(dir, name));
  }
  console.log("Updated", folder);
}
