/**
 * Generates public/game/board-aligned.svg — 15×15 viewBox matching LUDO_TRACK_CELLS exactly.
 * Run: node scripts/generate-ludo-board-svg.mjs
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const TRACK = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7],
  [5, 7], [5, 6], [4, 6], [4, 7], [4, 8], [5, 8], [6, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8], [7, 7],
  [8, 7], [8, 8], [9, 8], [9, 7], [10, 7], [11, 7], [11, 6], [10, 6],
  [9, 6], [8, 6], [7, 6], [7, 5], [8, 5], [8, 4], [7, 4], [7, 3],
  [8, 3], [8, 2], [7, 2], [7, 1], [8, 1], [8, 0], [7, 0],
];

const SAFE_IDX = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

/** position index → (row,col) */
const posToRC = new Map();
TRACK.forEach(([r, c], i) => posToRC.set(i, [r, c]));

/** RED home lane cells (approx: col 7 rows 8..12, exact from engine path tail) */
function redHomeLane([r, c]) {
  return c === 7 && r >= 8 && r <= 12;
}
function blueHomeLane([r, c]) {
  return r === 7 && c >= 8 && c <= 12;
}
function greenHomeLane([r, c]) {
  return r === 7 && c >= 2 && c <= 6;
}
function yellowHomeLane([r, c]) {
  return c === 7 && r >= 2 && r <= 6;
}

function inNestBlue([r, c]) {
  return r >= 1 && r <= 4 && c >= 1 && c <= 4;
}
function inNestGreen([r, c]) {
  return r >= 1 && r <= 4 && c >= 10 && c <= 13;
}
function inNestRed([r, c]) {
  return r >= 10 && r <= 13 && c >= 1 && c <= 4;
}
function inNestYellow([r, c]) {
  return r >= 10 && r <= 13 && c >= 10 && c <= 13;
}

function cellFill(r, c) {
  const rc = [r, c];
  const onTrack = TRACK.some(([a, b]) => a === r && b === c);

  if (inNestBlue(rc)) return "#fff9f0";
  if (inNestGreen(rc)) return "#fff9f0";
  if (inNestRed(rc)) return "#fff9f0";
  if (inNestYellow(rc)) return "#fff9f0";

  if (r < 6 && c < 6) return "#2d7fbd";
  if (r < 6 && c > 8) return "#2d9b57";
  if (r > 8 && c < 6) return "#b83a2e";
  if (r > 8 && c > 8) return "#c9a227";

  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    if (r === 7 && c === 7) return "#4a3728";
    if (r === 6 && c === 7) return "#2d7fbd";
    if (r === 7 && c === 8) return "#c9a227";
    if (r === 8 && c === 7) return "#b83a2e";
    if (r === 7 && c === 6) return "#2d9b57";
    return "#6b5344";
  }

  if (onTrack) {
    if (redHomeLane(rc)) return "#e0786e";
    if (blueHomeLane(rc)) return "#6eb3e0";
    if (greenHomeLane(rc)) return "#6ed198";
    if (yellowHomeLane(rc)) return "#e8d066";
    return "#e8dcc8";
  }

  return "#5c4837";
}

function safeStar(r, c) {
  for (const [idx, [rr, cc]] of [...posToRC.entries()]) {
    if (rr === r && cc === c && SAFE_IDX.has(idx)) return true;
  }
  return false;
}

const parts = [];
parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" width="900" height="900">`
);
parts.push(
  `<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.03" dy="0.04" stdDeviation="0.06" flood-opacity="0.35"/></filter></defs>`
);

for (let r = 0; r < 15; r++) {
  for (let c = 0; c < 15; c++) {
    const x = c;
    const y = r;
    const fill = cellFill(r, c);
    parts.push(
      `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" stroke="#3d2e18" stroke-width="0.03" rx="0.08"/>`
    );
    if (safeStar(r, c)) {
      parts.push(
        `<text x="${c + 0.5}" y="${r + 0.62}" font-size="0.42" text-anchor="middle" fill="#6b5a4a">★</text>`
      );
    }
  }
}

parts.push(`<rect x="0" y="0" width="15" height="15" fill="none" stroke="#2a1d12" stroke-width="0.25" rx="0.35" filter="url(#s)"/>`);
parts.push(`</svg>`);

const out = join(root, "public/game/board-aligned.svg");
writeFileSync(out, parts.join("\n"), "utf8");
console.log("Wrote", out);
