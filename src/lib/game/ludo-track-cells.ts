import type { PlayerColor } from "./ludo-engine";

/**
 * Board cells are 15x15 logical Illustrator coordinates.
 *
 * Piece `position` is color-relative progress:
 * - -1: inside the home nest
 * - 0..50: outer loop, starting from that piece color's entry square. A colour
 *   walks 51 shared-loop cells and then turns into its own home lane — it never
 *   steps onto loop cell 51 (the square just before its own start).
 * - 51..55: that colour's 5-cell home lane toward the center
 * - 56: finished (in the center goal)
 */
export const OUTER_TRACK_LENGTH = 52; // physical shared loop size
export const HOME_LANE_START = 51; // progress value of the first home-lane cell
export const FINISH_PROGRESS = 56;

const START_OFFSETS: Record<PlayerColor, number> = {
  RED: 0,
  BLUE: 13,
  GREEN: 26,
  YELLOW: 39,
};

/**
 * Global outer loop. Index 0 is RED's Ludo King-style start square.
 * The other start squares are exactly 13 cells apart:
 * RED [13,6], BLUE [6,1], GREEN [1,8], YELLOW [8,13].
 */
export const LUDO_TRACK_CELLS: ReadonlyArray<readonly [number, number]> = [
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
];

export const HOME_LANE_CELLS: Record<PlayerColor, ReadonlyArray<readonly [number, number]>> = {
  RED: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
  BLUE: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  GREEN: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  YELLOW: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
};

export const SAFE_OUTER_TRACK_INDICES = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

export function pathPositionToOuterIndex(
  color: PlayerColor,
  position: number
): number | null {
  // Only progress 0..50 is on the shared loop; 51+ is the private home lane.
  if (position < 0 || position >= HOME_LANE_START) return null;
  return (START_OFFSETS[color] + position) % OUTER_TRACK_LENGTH;
}

export function outerIndexToPathPosition(
  color: PlayerColor,
  outerIndex: number
): number | null {
  if (outerIndex < 0 || outerIndex >= OUTER_TRACK_LENGTH) return null;
  return (
    (outerIndex - START_OFFSETS[color] + OUTER_TRACK_LENGTH) %
    OUTER_TRACK_LENGTH
  );
}

export function getCellForPathPosition(
  color: PlayerColor,
  position: number
): readonly [number, number] | null {
  const outerIndex = pathPositionToOuterIndex(color, position);
  if (outerIndex !== null) return LUDO_TRACK_CELLS[outerIndex] ?? null;

  if (position >= HOME_LANE_START && position < FINISH_PROGRESS) {
    return HOME_LANE_CELLS[color][position - HOME_LANE_START] ?? null;
  }

  return null;
}
