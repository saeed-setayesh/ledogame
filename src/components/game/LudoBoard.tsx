"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LudoGameState, PlayerColor } from "@/lib/game/ludo-engine";
import {
  HOME_LANE_CELLS,
  LUDO_TRACK_CELLS,
  SAFE_OUTER_TRACK_INDICES,
} from "@/lib/game/ludo-track-cells";
import GamePiece from "./GamePiece";

interface LudoBoardProps {
  gameState: LudoGameState;
  currentUserId: string;
  onMovePiece?: (pieceId: number) => void;
  availableMoves?: number[];
  isMyTurn?: boolean;
}

const COLORS: Record<PlayerColor, { bg: string; dark: string; soft: string }> =
  {
    RED: { bg: "#ef1d17", dark: "#b80f10", soft: "rgba(239,29,23,0.72)" },
    BLUE: { bg: "#008ad8", dark: "#006496", soft: "rgba(0,138,216,0.72)" },
    GREEN: { bg: "#36a900", dark: "#237600", soft: "rgba(54,169,0,0.72)" },
    YELLOW: { bg: "#f4a000", dark: "#bd7400", soft: "rgba(244,160,0,0.72)" },
  };

const HOME_AREAS: Record<
  PlayerColor,
  { rows: [number, number]; cols: [number, number] }
> = {
  BLUE: { rows: [0, 5], cols: [0, 5] },
  GREEN: { rows: [0, 5], cols: [9, 14] },
  RED: { rows: [9, 14], cols: [0, 5] },
  YELLOW: { rows: [9, 14], cols: [9, 14] },
};

const START_CELLS: Record<string, PlayerColor> = {
  "13,6": "RED",
  "6,1": "BLUE",
  "1,8": "GREEN",
  "8,13": "YELLOW",
};

const OUTER_TRACK_SET = new Set(LUDO_TRACK_CELLS.map(([r, c]) => `${r},${c}`));
const SAFE_CELL_SET = new Set(
  [...SAFE_OUTER_TRACK_INDICES].map((index) => {
    const [r, c] = LUDO_TRACK_CELLS[index];
    return `${r},${c}`;
  })
);
const HOME_LANE_COLOR_BY_CELL = new Map<string, PlayerColor>(
  Object.entries(HOME_LANE_CELLS).flatMap(([color, cells]) =>
    cells.map(([r, c]) => [`${r},${c}`, color as PlayerColor])
  )
);

function areaContains(
  area: { rows: [number, number]; cols: [number, number] },
  row: number,
  col: number
) {
  return (
    row >= area.rows[0] &&
    row <= area.rows[1] &&
    col >= area.cols[0] &&
    col <= area.cols[1]
  );
}

function homeColorForCell(row: number, col: number): PlayerColor | null {
  for (const [color, area] of Object.entries(HOME_AREAS)) {
    if (areaContains(area, row, col)) return color as PlayerColor;
  }
  return null;
}

function isNestCell(row: number, col: number): boolean {
  return (
    (row >= 1 && row <= 4 && col >= 1 && col <= 4) ||
    (row >= 1 && row <= 4 && col >= 10 && col <= 13) ||
    (row >= 10 && row <= 13 && col >= 1 && col <= 4) ||
    (row >= 10 && row <= 13 && col >= 10 && col <= 13)
  );
}

function boardCellStyle(row: number, col: number): CSSProperties {
  const key = `${row},${col}`;
  const homeLaneColor = HOME_LANE_COLOR_BY_CELL.get(key);
  const startColor = START_CELLS[key];
  const homeColor = homeColorForCell(row, col);
  const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;

  if (isCenter) {
    return {
      background:
        "radial-gradient(circle at center, rgba(255,240,214,0.9), rgba(120,65,28,0.88))",
      borderColor: "rgba(70,35,15,0.3)",
    };
  }

  if (homeColor) {
    if (isNestCell(row, col)) {
      return {
        background:
          "linear-gradient(135deg, rgba(255,241,196,0.98), rgba(218,165,75,0.88))",
        borderColor: "rgba(120,75,28,0.18)",
      };
    }
    return {
      background: `linear-gradient(135deg, ${COLORS[homeColor].bg}, ${COLORS[homeColor].dark})`,
      borderColor: "rgba(0,0,0,0.14)",
    };
  }

  if (homeLaneColor || startColor) {
    const color = homeLaneColor ?? startColor;
    return {
      background: `linear-gradient(135deg, ${COLORS[color].bg}, ${COLORS[color].dark})`,
      borderColor: "rgba(0,0,0,0.16)",
    };
  }

  if (OUTER_TRACK_SET.has(key)) {
    return {
      background:
        "linear-gradient(135deg, rgba(255,236,184,0.96), rgba(211,151,63,0.72))",
      borderColor: "rgba(118,73,24,0.16)",
    };
  }

  return {
    background:
      "linear-gradient(135deg, rgba(226,171,82,0.42), rgba(255,232,164,0.38))",
    borderColor: "rgba(120,75,28,0.08)",
  };
}

function CellMarker({ row, col }: { row: number; col: number }) {
  const key = `${row},${col}`;
  const startColor = START_CELLS[key];
  const safe = SAFE_CELL_SET.has(key);

  if (startColor) {
    const arrow: Record<PlayerColor, string> = {
      RED: "↑",
      BLUE: "→",
      GREEN: "↓",
      YELLOW: "←",
    };
    return (
      <span
        className="text-[clamp(14px,3vw,24px)] font-black leading-none"
        style={{ color: COLORS[startColor].dark }}
      >
        {arrow[startColor]}
      </span>
    );
  }

  if (safe) {
    return (
      <span className="text-[clamp(10px,2.3vw,18px)] text-white/75 leading-none">
        ★
      </span>
    );
  }

  return null;
}

function CenterHome() {
  return (
    <div className="pointer-events-none absolute left-[40%] top-[40%] h-[20%] w-[20%] overflow-hidden rounded-md border border-black/25 shadow-inner">
      <div
        className="absolute inset-0"
        style={{
          background:
            "conic-gradient(from 45deg, #36a900 0 25%, #f4a000 0 50%, #ef1d17 0 75%, #008ad8 0 100%)",
        }}
      />
    </div>
  );
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

  // Briefly flag the piece that just moved (any player) so it's easy to follow.
  const lm = gameState.lastMove;
  const lmKey = lm ? `${lm.playerId}:${lm.pieceMoved}:${lm.toPosition}` : "";
  const [movedKey, setMovedKey] = useState("");
  const lmKeyRef = useRef("");
  useEffect(() => {
    if (!lmKey || lmKey === lmKeyRef.current) return;
    lmKeyRef.current = lmKey;
    setMovedKey(lmKey);
    const t = setTimeout(() => setMovedKey(""), 1200);
    return () => clearTimeout(t);
  }, [lmKey]);

  return (
    <div
      className="relative overflow-hidden rounded-[7%] border-[clamp(8px,2.2vw,16px)] border-[#7a3c16] shadow-2xl"
      style={{
        width: "min(92vw, calc(100dvh - 18rem), 560px)",
        aspectRatio: "1 / 1",
        background:
          "linear-gradient(135deg, #6d3513, #b96a24 36%, #5b250d 72%, #d28a35)",
      }}
    >
      <div
        className="absolute inset-[2.5%] grid overflow-hidden rounded-[5%] border border-black/25"
        style={{
          gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
          gridTemplateRows: "repeat(15, minmax(0, 1fr))",
          background:
            "linear-gradient(135deg, rgba(219,151,61,0.92), rgba(255,219,132,0.9))",
        }}
      >
        {Array.from({ length: 225 }, (_, index) => {
          const row = Math.floor(index / 15);
          const col = index % 15;
          return (
            <div
              key={`${row}-${col}`}
              className="flex items-center justify-center border"
              style={boardCellStyle(row, col)}
            >
              <CellMarker row={row} col={col} />
            </div>
          );
        })}
      </div>

      <CenterHome />

      {gameState.players.map((player) => {
        // availableMoves is a bare list of piece ids (0-3) — it only applies to
        // *my* pieces, never an opponent's piece that happens to share an id.
        const isMine = player.userId === currentUserId;
        return player.pieces.map((piece) => {
          const canMove =
            isMine && isMyTurn && availableMoves.includes(piece.id);
          const justMoved =
            !!movedKey &&
            lm?.playerId === player.id &&
            lm?.pieceMoved === piece.id;
          return (
            <GamePiece
              key={`${player.id}-${piece.id}`}
              pieceId={piece.id}
              color={player.color}
              position={piece.position}
              isHome={piece.isHome}
              isFinished={piece.isFinished}
              onClick={() => {
                if (canMove && onMovePiece) onMovePiece(piece.id);
              }}
              selected={false}
              canMove={canMove}
              justMoved={justMoved}
            />
          );
        });
      })}
    </div>
  );
}
