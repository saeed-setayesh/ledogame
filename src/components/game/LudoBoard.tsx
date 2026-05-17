"use client";

import { LudoGameState } from "@/lib/game/ludo-engine";
import GamePiece from "./GamePiece";

interface LudoBoardProps {
  gameState: LudoGameState;
  currentUserId: string;
  onMovePiece?: (pieceId: number) => void;
  availableMoves?: number[];
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
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl"
      style={{
        /**
         * `board.svg` is your Illustrator board (`files/Bord/bord-0۱.svg`), copied to public.
         * Piece math in GamePiece.tsx uses PLAY_INSET to match the wooden frame.
         */
        width: "min(92vw, calc(100dvh - 18rem), 560px)",
        aspectRatio: "1 / 1",
        backgroundImage: "url(/game/board.webp)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {gameState.players.map((player) =>
        player.pieces.map((piece) => (
          <GamePiece
            key={`${player.id}-${piece.id}`}
            pieceId={piece.id}
            color={player.color}
            position={piece.position}
            isHome={piece.isHome}
            isFinished={piece.isFinished}
            onClick={() => {
              if (isMyTurn && availableMoves.includes(piece.id) && onMovePiece) {
                onMovePiece(piece.id);
              }
            }}
            selected={false}
            canMove={isMyTurn && availableMoves.includes(piece.id)}
          />
        ))
      )}
    </div>
  );
}
