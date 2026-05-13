"use client";

import { cn } from "@/lib/utils";
import { PlayerColor } from "@/lib/game/ludo-engine";
import { LUDO_TRACK_CELLS } from "@/lib/game/ludo-track-cells";
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

const WOOD: Record<PlayerColor, string> = {
  RED: "/game/pieces/wood-red.png",
  BLUE: "/game/pieces/wood-blue.png",
  GREEN: "/game/pieces/wood-green.png",
  YELLOW: "/game/pieces/wood-yellow.png",
};

const GRID = 15;

function getBoardPosition(position: number): React.CSSProperties {
  if (position < 0 || position > 51) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 };
  }
  const [row, col] = LUDO_TRACK_CELLS[position];
  const cell = 100 / GRID;
  return {
    left: `${(col + 0.5) * cell}%`,
    top: `${(row + 0.5) * cell}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 10,
  };
}

/** Four nest slots: 2×2 grid in % within each home quadrant of the 15×15 board art. */
function getHomePosition(
  color: PlayerColor,
  pieceId: number
): React.CSSProperties {
  const col = pieceId % 2;
  const row = Math.floor(pieceId / 2);
  const step = 11;

  const bases: Record<PlayerColor, readonly [number, number]> = {
    RED: [16, 66],
    BLUE: [62, 14],
    GREEN: [16, 14],
    YELLOW: [62, 66],
  };

  const [baseL, baseT] = bases[color];

  return {
    left: `${baseL + col * step}%`,
    top: `${baseT + row * step}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 10,
  };
}

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
  if (isFinished) {
    return null;
  }

  const outerStyle: React.CSSProperties = {
    position: "absolute",
    ...(isHome ? getHomePosition(color, pieceId) : getBoardPosition(position)),
  };

  return (
    <div
      onClick={onClick}
      style={outerStyle}
      className={cn(
        "pointer-events-auto touch-manipulation",
        canMove && "cursor-pointer",
        !canMove && "cursor-not-allowed"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 md:border-[3px] border-black/25",
          "shadow-lg flex items-center justify-center bg-cover bg-center",
          "transition-[box-shadow,transform,filter] duration-300",
          color === "RED" && "ring-1 ring-red-900/40",
          color === "BLUE" && "ring-1 ring-blue-900/40",
          color === "GREEN" && "ring-1 ring-green-900/40",
          color === "YELLOW" && "ring-1 ring-amber-900/40",
          canMove &&
            "hover:scale-125 active:scale-110 hover:shadow-2xl hover:z-20",
          canMove && "animate-pulse-glow",
          selected &&
            "ring-4 ring-white ring-offset-2 ring-offset-gray-800 scale-125 z-20",
          !canMove && "opacity-85"
        )}
        style={{ backgroundImage: `url(${WOOD[color]})` }}
      >
        {canMove && (
          <div className="absolute inset-0 rounded-full bg-white/15 animate-ping" />
        )}
      </div>
    </div>
  );
}
