"use client";

import { LudoGameState } from "@/lib/game/ludo-engine";
import GamePiece from "./GamePiece";
import Image from "next/image";

interface LudoBoardProps {
  gameState: LudoGameState;
  currentUserId: string;
  onMovePiece?: (pieceId: number) => void;
  availableMoves?: number[];
  /** When false, pieces are not clickable for this user. */
  isMyTurn?: boolean;
}

export default function LudoBoard({
  gameState,
  currentUserId,
  onMovePiece,
  availableMoves = [],
  isMyTurn: isMyTurnProp,
}: LudoBoardProps) {
  const playerIndex = gameState.players.findIndex(
    (p) => p.userId === currentUserId
  );
  const isMyTurn =
    isMyTurnProp !== undefined
      ? isMyTurnProp
      : playerIndex !== -1 && gameState.currentTurn === playerIndex;

  return (
    <div className="relative w-full mx-auto">
      <div
        className="relative rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden"
        style={
          {
            width: "var(--board-size, min(92vw, min(100dvh - 14rem, 600px)))",
            aspectRatio: "1 / 1",
            margin: "0 auto",
          } as React.CSSProperties
        }
      >
        <Image
          src="/game/board.svg"
          alt=""
          fill
          className="object-contain pointer-events-none select-none"
          priority
          unoptimized
        />
        {gameState.players.map((player) =>
          player.pieces.map((piece) => (
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
