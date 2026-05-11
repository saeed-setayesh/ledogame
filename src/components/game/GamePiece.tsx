"use client";

import { cn } from "@/lib/utils";
import { PlayerColor } from "@/lib/game/ludo-engine";
import React from "react";

interface GamePieceProps {
  color: PlayerColor;
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

function getBoardPosition(
  position: number,
  color: PlayerColor
): React.CSSProperties {
  const cellSize = 100 / 15;
  let row = 6;
  let col = 6;

  if (position >= 0 && position <= 51) {
    if (position < 6) {
      row = 6;
      col = position;
    } else if (position < 13) {
      row = 12 - position;
      col = 8;
    } else if (position < 19) {
      row = 6;
      col = position + 1;
    } else if (position < 26) {
      row = position - 12;
      col = 8;
    } else if (position < 32) {
      row = 8;
      col = 38 - position;
    } else if (position < 39) {
      row = position - 23;
      col = 6;
    } else if (position < 45) {
      row = 8;
      col = 44 - position;
    } else {
      row = 50 - position;
      col = 6;
    }
  }

  return {
    left: `${(col + 0.5) * cellSize}%`,
    top: `${(row + 0.5) * cellSize}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 10,
  };
}

function getHomePosition(color: PlayerColor): React.CSSProperties {
  const homePositions: Record<PlayerColor, React.CSSProperties> = {
    RED: { top: "8px", left: "8px", zIndex: 10 },
    BLUE: { top: "8px", right: "8px", left: "auto", zIndex: 10 },
    GREEN: { bottom: "8px", left: "8px", top: "auto", zIndex: 10 },
    YELLOW: {
      bottom: "8px",
      right: "8px",
      top: "auto",
      left: "auto",
      zIndex: 10,
    },
  };

  return homePositions[color];
}

export default function GamePiece({
  color,
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 md:border-[3px] border-black/25",
        "shadow-lg transition-all duration-300",
        "flex items-center justify-center touch-manipulation bg-cover bg-center",
        color === "RED" && "ring-1 ring-red-900/40",
        color === "BLUE" && "ring-1 ring-blue-900/40",
        color === "GREEN" && "ring-1 ring-green-900/40",
        color === "YELLOW" && "ring-1 ring-amber-900/40",
        canMove &&
          "cursor-pointer hover:scale-125 active:scale-110 hover:shadow-2xl hover:z-20",
        canMove && "animate-pulse-glow",
        selected &&
          "ring-4 ring-white ring-offset-2 ring-offset-gray-800 scale-125 z-20",
        !canMove && "opacity-85 cursor-not-allowed"
      )}
      style={{
        position: "absolute",
        backgroundImage: `url(${WOOD[color]})`,
        ...(isHome ? getHomePosition(color) : getBoardPosition(position, color)),
      }}
    >
      {canMove && (
        <div className="absolute inset-0 rounded-full bg-white/15 animate-ping" />
      )}
    </div>
  );
}
