#!/usr/bin/env node
/**
 * Generate PWA PNG icons from scratch using raw PNG encoding.
 * No external dependencies required.
 * Creates a simple icon with "雷" character silhouette via a solid color block.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPNG(width, height, bgR, bgG, bgB) {
  // Create raw pixel data (RGBA)
  const pixels = Buffer.alloc(width * height * 4);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.42;
  const innerRadius = width * 0.28;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < innerRadius) {
        // Inner gold circle
        pixels[idx] = 255;     // R
        pixels[idx + 1] = 215; // G
        pixels[idx + 2] = 0;   // B
        pixels[idx + 3] = 255; // A
      } else if (dist < radius) {
        // Red ring
        pixels[idx] = bgR;
        pixels[idx + 1] = bgG;
        pixels[idx + 2] = bgB;
        pixels[idx + 3] = 255;
      } else if (dist < radius + 3) {
        // Gold border
        pixels[idx] = 255;
        pixels[idx + 1] = 215;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 255;
      } else {
        // Rounded corner background
        const cornerRadius = width * 0.15;
        const inRect =
          x >= cornerRadius && x < width - cornerRadius ||
          y >= cornerRadius && y < height - cornerRadius;

        let inRoundedRect = inRect;
        if (!inRoundedRect) {
          // Check corners
          const corners = [
            [cornerRadius, cornerRadius],
            [width - cornerRadius, cornerRadius],
            [cornerRadius, height - cornerRadius],
            [width - cornerRadius, height - cornerRadius],
          ];
          for (const [cx, cy] of corners) {
            const cdx = x - cx;
            const cdy = y - cy;
            if (Math.sqrt(cdx * cdx + cdy * cdy) <= cornerRadius) {
              inRoundedRect = true;
              break;
            }
          }
        }

        if (inRoundedRect) {
          // Dark background
          pixels[idx] = 10;
          pixels[idx + 1] = 5;
          pixels[idx + 2] = 6;
          pixels[idx + 3] = 255;
        } else {
          // Transparent
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 0;
        }
      }
    }
  }

  // Build PNG
  // Filter each row with filter byte 0 (None)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter byte
    pixels.copy(
      rawData,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return crc ^ 0xffffffff;
}

// Generate icons
const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const icon192 = createPNG(192, 192, 212, 56, 44);
fs.writeFileSync(path.join(outDir, "icon-192.png"), icon192);
console.log("Created icon-192.png (192x192)");

const icon512 = createPNG(512, 512, 212, 56, 44);
fs.writeFileSync(path.join(outDir, "icon-512.png"), icon512);
console.log("Created icon-512.png (512x512)");

// Also create apple-touch-icon (180x180)
const icon180 = createPNG(180, 180, 212, 56, 44);
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), icon180);
console.log("Created apple-touch-icon.png (180x180)");

console.log("Done!");
