"use client";

import { cn } from "@/lib/utils";
import { PlayerColor } from "@/lib/game/ludo-engine";
import { LUDO_TRACK_CELLS } from "@/lib/game/ludo-track-cells";
import Image from "next/image";
import React from "react";

interface GamePieceProps {
  color: PlayerColor;
  pieceId: number;
  position: number;
  isHome: boolean;
  isFinished: boolean;
  onClick?: () => void;
  selected?: boolean;
  canMove?: boolean;
}

/**
 * Visual board: `public/game/board.webp` (from your `files/Bord/bord-0۱.png`).
 * The wooden frame eats ~10.8% on each side of the image; the 15×15 logic
 * grid is mapped onto the inner playable square only.
 */
const GRID = 15;
const PLAY_INSET = 0.108;
const PLAY_SCALE = 1 - 2 * PLAY_INSET;

const PIECE_SRC: Record<PlayerColor, string> = {
  RED: "/game/pieces/red.png",
  BLUE: "/game/pieces/blue.png",
  GREEN: "/game/pieces/green.png",
  YELLOW: "/game/pieces/yellow.png",
};

/** Map normalized grid coord in 0–1 (center of cell = (i+0.5)/15) → % of full board image */
function gridToPercent(gx: number, gy: number): React.CSSProperties {
  const x = (PLAY_INSET + gx * PLAY_SCALE) * 100;
  const y = (PLAY_INSET + gy * PLAY_SCALE) * 100;
  return { left: `${x}%`, top: `${y}%` };
}

/**
 * 2×2 home slot centers in the 15×15 logic grid.
 * Each colored quadrant spans cells (0–5) on its side; the white nest centers
 * around the quadrant midpoint. Centering 4 pieces around (3, 3) / (12, 3) /
 * (3, 12) / (12, 12) puts them squarely inside the home circle.
 */
const HOME_GRID: Record<PlayerColor, readonly [number, number][]> = {
  BLUE: [
    [2, 2],
    [4, 2],
    [2, 4],
    [4, 4],
  ],
  GREEN: [
    [11, 2],
    [13, 2],
    [11, 4],
    [13, 4],
  ],
  RED: [
    [2, 11],
    [4, 11],
    [2, 13],
    [4, 13],
  ],
  YELLOW: [
    [11, 11],
    [13, 11],
    [11, 13],
    [13, 13],
  ],
};

function getBoardPosition(position: number): React.CSSProperties {
  if (position < 0 || position > 51) {
    return { left: "50%", top: "50%" };
  }
  const [row, col] = LUDO_TRACK_CELLS[position];
  const gx = (col + 0.5) / GRID;
  const gy = (row + 0.5) / GRID;
  return gridToPercent(gx, gy);
}

function getHomePosition(color: PlayerColor, pieceId: number): React.CSSProperties {
  const slot = HOME_GRID[color][pieceId] ?? HOME_GRID[color][0];
  const [cx, cy] = slot;
  return gridToPercent(cx / GRID, cy / GRID);
}

const PIECE_W = "6.2%";

export default function GamePiece({
  color,
  pieceId,
  position,
  isHome,
  isFinished,
  onClick,
  selected,
  canMove,
}: GamePieceProps) {
  if (isFinished) return null;

  const pos = isHome ? getHomePosition(color, pieceId) : getBoardPosition(position);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canMove}
      aria-label={`${color} piece ${pieceId + 1}`}
      style={{
        position: "absolute",
        ...pos,
        width: PIECE_W,
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
        zIndex: canMove ? 30 : selected ? 25 : 10,
        background: "transparent",
        border: "none",
        padding: 0,
      }}
      className={cn(
        "touch-manipulation select-none",
        canMove ? "cursor-pointer" : "cursor-default disabled:cursor-default",
        "transition-transform duration-200",
        canMove && "hover:scale-125 active:scale-110 animate-pulse-glow",
        selected && "scale-125",
        !canMove && "opacity-95"
      )}
    >
      <Image
        src={PIECE_SRC[color]}
        alt=""
        fill
        sizes="56px"
        className="object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.65)] pointer-events-none"
        unoptimized
      />
      {canMove && (
        <span className="absolute inset-0 rounded-full bg-white/20 animate-ping pointer-events-none" />
      )}
    </button>
  );
}
