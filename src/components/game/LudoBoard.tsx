"use client";

import { LudoGameState } from "@/lib/game/ludo-engine";
import GamePiece from "./GamePiece";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { LUDO_TRACK_CELLS } from "@/lib/game/ludo-track-cells";

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
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const playerIndex = gameState.players.findIndex(
    (p) => p.userId === currentUserId
  );
  const isMyTurn =
    isMyTurnProp !== undefined
      ? isMyTurnProp
      : playerIndex !== -1 && gameState.currentTurn === playerIndex;

  // #region agent log
  useLayoutEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const img = el.querySelector("img");
    const cr = el.getBoundingClientRect();
    const ir = img?.getBoundingClientRect();
    const pieces = gameState.players.flatMap((pl) =>
      pl.pieces
        .filter((pc) => !pc.isFinished)
        .map((pc) => ({
          c: pl.color,
          pos: pc.position,
          home: pc.isHome,
          id: pc.id,
          trackrc:
            !pc.isHome &&
            pc.position >= 0 &&
            pc.position <= 51 &&
            LUDO_TRACK_CELLS[pc.position]
              ? LUDO_TRACK_CELLS[pc.position]
              : null,
        }))
    );
    fetch("http://127.0.0.1:7400/ingest/1d450167-b174-499a-936a-1a9f2340e5c6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f011d2",
      },
      body: JSON.stringify({
        sessionId: "f011d2",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "LudoBoard.tsx:layout",
        message: "board container vs img bounds + piece states",
        data: {
          container: { w: cr.width, h: cr.height },
          img: ir
            ? { w: ir.width, h: ir.height, dx: ir.left - cr.left, dy: ir.top - cr.top }
            : null,
          letterboxX:
            ir && cr.width > 0 ? (cr.width - ir.width) / 2 / cr.width : null,
          letterboxY:
            ir && cr.height > 0 ? (cr.height - ir.height) / 2 / cr.height : null,
          pieces,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [gameState]);
  // #endregion

  return (
    <div className="relative w-full mx-auto">
      <div
        ref={boardWrapRef}
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
          src="/game/board-ludino-reference.png"
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
              pieceId={piece.id}
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
