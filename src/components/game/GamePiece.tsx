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

const colorClasses: Record<PlayerColor, string> = {
  RED: "piece-gloss piece-red",
  BLUE: "piece-gloss piece-blue",
  GREEN: "piece-gloss piece-green",
  YELLOW: "piece-gloss piece-yellow",
};

// Board position mapping (15x15 grid)
// Convert position number to row/col on the board
// The board has a cross pattern with paths around it
function getBoardPosition(
  position: number,
  color: PlayerColor
): React.CSSProperties {
  // Board is 15x15 grid (0-14 for rows and cols)
  const cellSize = 100 / 15; // Percentage

  // Calculate position based on the board layout
  // The main path goes around the board in a square pattern
  // Row 6 and Col 6-8 are the center cross (safe zone)

  let row = 6;
  let col = 6;

  if (position >= 0 && position <= 51) {
    // Map position to board coordinates
    // Path goes: right along row 6, down col 8, left along row 8, up col 6, repeat
    if (position < 6) {
      // Top horizontal (row 6, cols 0-5)
      row = 6;
      col = position;
    } else if (position < 13) {
      // Right vertical (rows 0-6, col 8)
      row = 12 - position;
      col = 8;
    } else if (position < 19) {
      // Top horizontal right side (row 6, cols 9-14)
      row = 6;
      col = position + 1;
    } else if (position < 26) {
      // Right vertical bottom (rows 7-13, col 8)
      row = position - 12;
      col = 8;
    } else if (position < 32) {
      // Bottom horizontal (row 8, cols 9-14)
      row = 8;
      col = 38 - position;
    } else if (position < 39) {
      // Left vertical bottom (rows 9-14, col 6)
      row = position - 23;
      col = 6;
    } else if (position < 45) {
      // Bottom horizontal left (row 8, cols 0-5)
      row = 8;
      col = 44 - position;
    } else {
      // Left vertical top (rows 0-5, col 6)
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
  // Position pieces in home areas (corners)
  // Responsive positioning based on home area size
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
    return null; // Piece is finished, don't render
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-8 h-8 md:w-10 md:h-10 rounded-full border-2 md:border-[3px]",
        colorClasses[color],
        "shadow-lg transition-all duration-300",
        "flex items-center justify-center",
        "touch-manipulation", // Better touch handling on mobile
        canMove &&
          "cursor-pointer hover:scale-125 active:scale-110 hover:shadow-2xl hover:z-20",
        canMove && "animate-pulse-glow",
        selected &&
          "ring-4 ring-white ring-offset-2 ring-offset-gray-800 scale-125 z-20",
        !canMove && "opacity-60 cursor-not-allowed"
      )}
      style={{
        position: "absolute",
        ...(isHome
          ? getHomePosition(color)
          : getBoardPosition(position, color)),
      }}
    >
      <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/40 shadow-inner" />
      {canMove && (
        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      )}
    </div>
  );
}
