"use client";

import { cn } from "@/lib/utils";
import { PlayerColor } from "@/lib/game/ludo-engine";
import { getCellForPathPosition } from "@/lib/game/ludo-track-cells";
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
 * Visual board is generated as a real 15x15 grid in `LudoBoard.tsx`.
 * Pieces use the same inner board inset so every position maps to a cell.
 */
const GRID = 15;
const PLAY_INSET = 0.025;
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
 * 2x2 home slot centers in the 15x15 Illustrator grid. These are fractional
 * grid coordinates for the inner white nests, not outer track cells.
 */
const HOME_GRID: Record<PlayerColor, readonly [number, number][]> = {
  BLUE: [
    [2.25, 2.25],
    [3.75, 2.25],
    [2.25, 3.75],
    [3.75, 3.75],
  ],
  GREEN: [
    [11.25, 2.25],
    [12.75, 2.25],
    [11.25, 3.75],
    [12.75, 3.75],
  ],
  RED: [
    [2.25, 11.25],
    [3.75, 11.25],
    [2.25, 12.75],
    [3.75, 12.75],
  ],
  YELLOW: [
    [11.25, 11.25],
    [12.75, 11.25],
    [11.25, 12.75],
    [12.75, 12.75],
  ],
};

function getBoardPosition(
  color: PlayerColor,
  position: number
): React.CSSProperties {
  const cell = getCellForPathPosition(color, position);
  if (!cell) {
    return { left: "50%", top: "50%" };
  }
  const [row, col] = cell;
  const gx = (col + 0.5) / GRID;
  const gy = (row + 0.5) / GRID;
  return gridToPercent(gx, gy);
}

function getHomePosition(color: PlayerColor, pieceId: number): React.CSSProperties {
  const slot = HOME_GRID[color][pieceId] ?? HOME_GRID[color][0];
  const [cx, cy] = slot;
  return gridToPercent(cx / GRID, cy / GRID);
}

const PIECE_W_TRACK = "4.8%";
const PIECE_W_HOME = "5.2%";

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

  const pos = isHome
    ? getHomePosition(color, pieceId)
    : getBoardPosition(color, position);
  const pieceWidth = isHome ? PIECE_W_HOME : PIECE_W_TRACK;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canMove}
      aria-label={`${color} piece ${pieceId + 1}`}
      style={{
        position: "absolute",
        ...pos,
        width: pieceWidth,
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
        canMove && "hover:scale-110 active:scale-105 animate-pulse-glow",
        selected && "scale-110",
        !canMove && "opacity-95"
      )}
    >
      <Image
        src={PIECE_SRC[color]}
        alt=""
        fill
        sizes="56px"
        className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] pointer-events-none"
        unoptimized
      />
      {canMove && (
        <span className="absolute inset-0 rounded-full bg-white/20 animate-ping pointer-events-none" />
      )}
    </button>
  );
}
