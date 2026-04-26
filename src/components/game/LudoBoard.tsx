"use client";

import { LudoGameState } from "@/lib/game/ludo-engine";
import GamePiece from "./GamePiece";
import { cn } from "@/lib/utils";

interface LudoBoardProps {
  gameState: LudoGameState;
  currentUserId: string;
  onMovePiece?: (pieceId: number) => void;
  availableMoves?: number[];
}

export default function LudoBoard({
  gameState,
  currentUserId,
  onMovePiece,
  availableMoves = [],
}: LudoBoardProps) {
  const playerIndex = gameState.players.findIndex(
    (p) => p.userId === currentUserId
  );
  const isMyTurn = playerIndex !== -1 && gameState.currentTurn === playerIndex;

  return (
    <div className="relative w-full mx-auto">
      {/* Mobile-first responsive sizing */}
      <div
        className="relative rounded-2xl md:rounded-3xl shadow-2xl p-2 md:p-4 lg:p-8"
        style={
          {
            width: "min(100vw - 1rem, 100vh - 18rem, 600px)",
            aspectRatio: "1 / 1",
            margin: "0 auto",
            // CSS variables allow skinning/themes
            "--tile-default": "linear-gradient(180deg, rgba(255,238,209,1), rgba(255,243,224,1))",
            "--tile-red": "linear-gradient(180deg,#ff9a8b,#ff6b35)",
            "--tile-blue": "linear-gradient(180deg,#9ad0ff,#3498db)",
            "--tile-green": "linear-gradient(180deg,#8fe3b0,#2ecc71)",
            "--tile-yellow": "linear-gradient(180deg,#ffe48b,#f1c40f)",
            "--board-border": "4px solid rgba(170,120,30,0.25)",
          } as React.CSSProperties
        }
      >
        {/* Board Grid */}
        <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] gap-0.5 md:gap-1 h-full w-full">
          {/* Render board cells */}
          {Array.from({ length: 15 * 15 }).map((_, i) => {
            const row = Math.floor(i / 15);
            const col = i % 15;
            const type = getCellType(row, col);
            const extra = getCellStyle(row, col);
            return (
              <div
                key={i}
                data-type={type}
                className={cn("aspect-square rounded-sm md:rounded tile", extra)}
              />
            );
          })}
        </div>

        {/* Home Areas with enhanced styling */}
        <div className="absolute top-1 left-1 md:top-2 md:left-2 w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg md:rounded-xl shadow-xl" style={{ background: "var(--tile-red)", border: "2px solid rgba(120,20,20,0.7)" }}>
          {/* Red home */}
        </div>
        <div className="absolute top-1 right-1 md:top-2 md:right-2 w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg md:rounded-xl shadow-xl" style={{ background: "var(--tile-blue)", border: "2px solid rgba(20,60,120,0.7)" }}>
          {/* Blue home */}
        </div>
        <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg md:rounded-xl shadow-xl" style={{ background: "var(--tile-green)", border: "2px solid rgba(20,120,60,0.7)" }}>
          {/* Green home */}
        </div>
        <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg md:rounded-xl shadow-xl" style={{ background: "var(--tile-yellow)", border: "2px solid rgba(160,120,20,0.7)" }}>
          {/* Yellow home */}
        </div>

        {/* Game Pieces */}
        {gameState.players.map((player) =>
          player.pieces.map((piece, pieceIndex) => (
            <GamePiece
              key={`${player.id}-${piece.id}`}
              color={player.color}
              position={piece.position}
              isHome={piece.isHome}
              isFinished={piece.isFinished}
              onClick={() => {
                if (
                  isMyTurn &&
                  availableMoves.includes(piece.id) &&
                  onMovePiece
                ) {
                  onMovePiece(piece.id);
                }
              }}
              selected={false}
              canMove={isMyTurn && availableMoves.includes(piece.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function getCellColor(row: number, col: number): string {
  // Center cross area (safe zone)
  if (
    (row >= 6 && row <= 8 && (col < 6 || col > 8)) ||
    (col >= 6 && col <= 8 && (row < 6 || row > 8))
  ) {
    return "bg-gradient-to-br from-amber-200 to-amber-300";
  }

  // Center area (finish zone)
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
    return "bg-gradient-to-br from-amber-300 to-amber-400";
  }

  // Safe positions (marked with special styling)
  const safePositions = [
    [1, 1],
    [1, 9],
    [9, 1],
    [9, 9], // Corner safe spots
    [6, 0],
    [6, 14],
    [0, 6],
    [14, 6], // Edge safe spots
  ];
  const isSafe = safePositions.some(([r, c]) => r === row && c === col);

  // Home paths with gradients
  if (row < 6 && col < 6) {
    return isSafe
      ? "bg-gradient-to-br from-red-300 to-red-400"
      : "bg-gradient-to-br from-red-200 to-red-300";
  }
  if (row < 6 && col > 8) {
    return isSafe
      ? "bg-gradient-to-br from-blue-300 to-blue-400"
      : "bg-gradient-to-br from-blue-200 to-blue-300";
  }
  if (row > 8 && col < 6) {
    return isSafe
      ? "bg-gradient-to-br from-green-300 to-green-400"
      : "bg-gradient-to-br from-green-200 to-green-300";
  }
  if (row > 8 && col > 8) {
    return isSafe
      ? "bg-gradient-to-br from-yellow-300 to-yellow-400"
      : "bg-gradient-to-br from-yellow-200 to-yellow-300";
  }

  return "bg-gradient-to-br from-amber-50 to-amber-100";
}

function getCellStyle(row: number, col: number): string {
  // Add subtle shadow to safe positions
  const safePositions = [
    [1, 1],
    [1, 9],
    [9, 1],
    [9, 9],
    [6, 0],
    [6, 14],
    [0, 6],
    [14, 6],
  ];
  const isSafe = safePositions.some(([r, c]) => r === row && c === col);

  if (isSafe) {
    return "shadow-inner ring-1 ring-amber-400/30";
  }

  return "";
}

function getCellType(row: number, col: number): string {
  // Mirror logic from getCellColor but return token string
  const safePositions = [
    [1, 1],
    [1, 9],
    [9, 1],
    [9, 9],
    [6, 0],
    [6, 14],
    [0, 6],
    [14, 6],
  ];
  const isSafe = safePositions.some(([r, c]) => r === row && c === col);

  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
    return "center";
  }

  if (row < 6 && col < 6) return isSafe ? "red-safe" : "red";
  if (row < 6 && col > 8) return isSafe ? "blue-safe" : "blue";
  if (row > 8 && col < 6) return isSafe ? "green-safe" : "green";
  if (row > 8 && col > 8) return isSafe ? "yellow-safe" : "yellow";

  if (
    (row >= 6 && row <= 8 && (col < 6 || col > 8)) ||
    (col >= 6 && col <= 8 && (row < 6 || row > 8))
  ) {
    return "path";
  }

  return "default";
}
