export type PlayerColor = "RED" | "BLUE" | "GREEN" | "YELLOW";
export type GameModeType = "CLASSIC" | "RUSH";
export type RushPhase = "ROLL" | "MOVE";

export interface GamePiece {
  id: number;
  position: number;
  color: PlayerColor;
  isHome: boolean;
  isFinished: boolean;
}

export interface Player {
  id: string;
  userId: string;
  color: PlayerColor;
  position: number;
  pieces: GamePiece[];
  hasRolled: boolean;
  canMove: boolean;
  /** Per-player roll; in CLASSIC only the current player has a value after rolling (mirrors diceValue). */
  diceValue: number | null;
}

export interface LudoGameState {
  players: Player[];
  currentTurn: number;
  diceValue: number | null;
  gameMode: GameModeType;
  /** RUSH only: simultaneous roll phase then ordered move phase. */
  rushPhase?: RushPhase;
  /** RUSH MOVE: seat i finished (moved or auto-skipped). */
  rushRoundSeatsDone?: boolean[];
  gameStatus: "WAITING" | "ACTIVE" | "FINISHED";
  winnerId: string | null;
  turnEndsAt: string | null;
  lastMove: {
    playerId: string;
    diceRoll: number;
    pieceMoved: number | null;
    fromPosition: number;
    toPosition: number;
  } | null;
}

const COLOR_PATHS: Record<PlayerColor, number[]> = {
  RED: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
  ],
  BLUE: [
    13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
    51, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ],
  GREEN: [
    26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
    45, 46, 47, 48, 49, 50, 51, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  ],
  YELLOW: [
    39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 0, 1, 2, 3, 4, 5, 6, 7,
    8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
  ],
};

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];

const START_POSITIONS: Record<PlayerColor, number> = {
  RED: 0,
  BLUE: 13,
  GREEN: 26,
  YELLOW: 39,
};

export function normalizeGameState(raw: unknown): LudoGameState {
  const s = raw as Partial<LudoGameState>;
  const gameMode: GameModeType =
    s.gameMode === "RUSH" ? "RUSH" : "CLASSIC";
  const players = (s.players || []).map((p: Player) => ({
    ...p,
    diceValue:
      typeof p.diceValue === "number" ? p.diceValue : null,
    hasRolled: !!p.hasRolled,
    canMove: !!p.canMove,
  }));
  return {
    players,
    currentTurn: typeof s.currentTurn === "number" ? s.currentTurn : 0,
    diceValue:
      s.diceValue !== undefined && s.diceValue !== null ? s.diceValue : null,
    gameMode,
    rushPhase:
      gameMode === "RUSH"
        ? s.rushPhase === "MOVE"
          ? "MOVE"
          : "ROLL"
        : undefined,
    rushRoundSeatsDone: Array.isArray(s.rushRoundSeatsDone)
      ? s.rushRoundSeatsDone
      : undefined,
    gameStatus: s.gameStatus === "FINISHED" ? "FINISHED" : s.gameStatus === "WAITING" ? "WAITING" : "ACTIVE",
    winnerId: s.winnerId ?? null,
    turnEndsAt: s.turnEndsAt ?? null,
    lastMove: s.lastMove ?? null,
  };
}

export class LudoEngine {
  private state: LudoGameState;

  constructor(
    players: {
      id: string;
      userId: string;
      color: PlayerColor;
      position: number;
    }[],
    gameMode: GameModeType = "CLASSIC"
  ) {
    this.state = this.initializeGame(players, gameMode);
  }

  setState(state: LudoGameState): void {
    this.state = normalizeGameState(state);
  }

  getState(): LudoGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  private initializeGame(
    players: {
      id: string;
      userId: string;
      color: PlayerColor;
      position: number;
    }[],
    gameMode: GameModeType
  ): LudoGameState {
    const gamePlayers: Player[] = players.map((p) => ({
      id: p.id,
      userId: p.userId,
      color: p.color,
      position: p.position,
      pieces: Array.from({ length: 4 }, (_, i) => ({
        id: i,
        position: -1,
        color: p.color,
        isHome: true,
        isFinished: false,
      })),
      hasRolled: false,
      canMove: false,
      diceValue: null,
    }));

    return {
      players: gamePlayers,
      currentTurn: 0,
      diceValue: null,
      gameMode,
      rushPhase: gameMode === "RUSH" ? "ROLL" : undefined,
      rushRoundSeatsDone: undefined,
      gameStatus: "ACTIVE",
      winnerId: null,
      turnEndsAt: null,
      lastMove: null,
    };
  }

  rollDice(playerId: string): number {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");
    if (player.hasRolled) throw new Error("You have already rolled the dice");

    if (this.state.gameMode === "RUSH") {
      if (this.state.rushPhase !== "ROLL") {
        throw new Error("Not in roll phase");
      }
      const diceValue = Math.floor(Math.random() * 6) + 1;
      player.diceValue = diceValue;
      player.hasRolled = true;
      player.canMove = this.canPlayerMove(player, diceValue);
      this.state.diceValue = null;

      const allRolled = this.state.players.every((p) => p.hasRolled);
      if (allRolled) {
        this.enterRushMovePhase();
      }
      return diceValue;
    }

    const currentPlayer = this.state.players[this.state.currentTurn];
    if (currentPlayer.id !== playerId) throw new Error("Not your turn");

    const diceValue = Math.floor(Math.random() * 6) + 1;
    this.state.diceValue = diceValue;
    player.diceValue = diceValue;
    player.hasRolled = true;
    player.canMove = this.canPlayerMove(player, diceValue);
    return diceValue;
  }

  /** After all RUSH players rolled: ordered move phase, auto-skip seats with no legal move. */
  private enterRushMovePhase(): void {
    this.state.rushPhase = "MOVE";
    this.state.rushRoundSeatsDone = this.state.players.map(() => false);
    this.state.diceValue = null;
    this.advanceRushMoveCursor();
  }

  /** Find next seat that must move, or finish round. */
  private advanceRushMoveCursor(): void {
    const n = this.state.players.length;
    const done = this.state.rushRoundSeatsDone!;
    for (let i = 0; i < n; i++) {
      if (done[i]) continue;
      const p = this.state.players[i];
      const dv = p.diceValue;
      if (dv === null) {
        done[i] = true;
        continue;
      }
      const moves = this.getAvailableMovesWithDice(p.id, dv);
      if (moves.length === 0) {
        done[i] = true;
        continue;
      }
      this.state.currentTurn = i;
      return;
    }
    this.endRushRound();
  }

  private endRushRound(): void {
    this.state.rushPhase = "ROLL";
    this.state.rushRoundSeatsDone = undefined;
    for (const p of this.state.players) {
      p.hasRolled = false;
      p.canMove = false;
      p.diceValue = null;
    }
    this.state.diceValue = null;
    this.state.currentTurn = 0;
  }

  private canPlayerMove(player: Player, diceValue: number): boolean {
    if (diceValue === 6) return true;
    return player.pieces.some((piece) => {
      if (piece.isHome && diceValue === 6) return true;
      if (!piece.isHome && !piece.isFinished) {
        return (
          this.calculateNewPosition(
            player.color,
            piece.position,
            diceValue
          ) !== null
        );
      }
      return false;
    });
  }

  movePiece(playerId: string, pieceId: number): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");

    if (this.state.gameMode === "RUSH") {
      if (this.state.rushPhase !== "MOVE") {
        throw new Error("Not in move phase");
      }
      const current = this.state.players[this.state.currentTurn];
      if (!current || current.id !== playerId) throw new Error("Not your turn");
      const diceValue = player.diceValue;
      if (diceValue === null) throw new Error("You must roll the dice first");

      return this.applyMove(player, pieceId, diceValue, () => {
        const done = this.state.rushRoundSeatsDone!;
        done[this.state.currentTurn] = true;
        this.advanceRushMoveCursor();
      });
    }

    const currentPlayer = this.state.players[this.state.currentTurn];
    if (currentPlayer.id !== playerId) throw new Error("Not your turn");
    if (!player.hasRolled || !this.state.diceValue) {
      throw new Error("You must roll the dice first");
    }
    const diceValue = this.state.diceValue;
    return this.applyMove(player, pieceId, diceValue, () => {
      if (diceValue !== 6) {
        this.nextTurnClassic();
      } else {
        player.hasRolled = false;
        player.canMove = false;
        player.diceValue = null;
        this.state.diceValue = null;
      }
    });
  }

  private applyMove(
    player: Player,
    pieceId: number,
    diceValue: number,
    afterMove: () => void
  ): boolean {
    const piece = player.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error("Piece not found");
    const fromPosition = piece.position;

    if (piece.isHome && diceValue === 6) {
      piece.isHome = false;
      piece.position = START_POSITIONS[player.color];
    } else if (!piece.isHome && !piece.isFinished) {
      const newPosition = this.calculateNewPosition(
        player.color,
        piece.position,
        diceValue
      );
      if (newPosition === null) throw new Error("Invalid move");
      piece.position = newPosition;
      if (this.isPieceFinished(player.color, newPosition)) {
        piece.isFinished = true;
        piece.position = 100 + piece.id;
      }
    } else {
      throw new Error("Invalid move");
    }

    this.checkCaptures(player, piece);
    this.state.lastMove = {
      playerId: player.id,
      diceRoll: diceValue,
      pieceMoved: pieceId,
      fromPosition,
      toPosition: piece.position,
    };

    if (this.checkWin(player)) {
      this.state.gameStatus = "FINISHED";
      this.state.winnerId = player.userId;
      return true;
    }

    afterMove();
    return false;
  }

  private calculateNewPosition(
    color: PlayerColor,
    currentPosition: number,
    diceValue: number
  ): number | null {
    if (currentPosition === -1) return null;
    const path = COLOR_PATHS[color];
    const currentIndex = path.indexOf(currentPosition);
    if (currentIndex === -1) return null;
    const newIndex = currentIndex + diceValue;
    if (newIndex >= path.length) return null;
    return path[newIndex];
  }

  private isPieceFinished(color: PlayerColor, position: number): boolean {
    const path = COLOR_PATHS[color];
    return position === path[path.length - 1];
  }

  private checkCaptures(player: Player, movedPiece: GamePiece): void {
    this.state.players.forEach((opponent) => {
      if (opponent.id === player.id) return;
      opponent.pieces.forEach((opponentPiece) => {
        if (
          !opponentPiece.isHome &&
          !opponentPiece.isFinished &&
          opponentPiece.position === movedPiece.position &&
          !SAFE_POSITIONS.includes(movedPiece.position)
        ) {
          opponentPiece.isHome = true;
          opponentPiece.position = -1;
        }
      });
    });
  }

  private checkWin(player: Player): boolean {
    return player.pieces.every((piece) => piece.isFinished);
  }

  private nextTurnClassic(): void {
    this.state.currentTurn =
      (this.state.currentTurn + 1) % this.state.players.length;
    const currentPlayer = this.state.players[this.state.currentTurn];
    currentPlayer.hasRolled = false;
    currentPlayer.canMove = false;
    currentPlayer.diceValue = null;
    this.state.diceValue = null;
    for (const p of this.state.players) {
      if (p.id !== currentPlayer.id) {
        p.diceValue = null;
      }
    }
  }

  skipTurn(): void {
    if (this.state.gameMode === "RUSH") {
      if (this.state.rushPhase === "MOVE") {
        const done = this.state.rushRoundSeatsDone;
        if (done) done[this.state.currentTurn] = true;
        this.advanceRushMoveCursor();
      }
      return;
    }
    if (this.state.diceValue === null) {
      this.nextTurnClassic();
    }
  }

  forceNextTurn(): void {
    if (this.state.gameMode === "RUSH" && this.state.rushPhase === "MOVE") {
      const done = this.state.rushRoundSeatsDone;
      if (done) done[this.state.currentTurn] = true;
      this.advanceRushMoveCursor();
      return;
    }
    this.nextTurnClassic();
  }

  getAvailableMoves(playerId: string): number[] {
    if (this.state.gameMode === "RUSH" && this.state.rushPhase === "MOVE") {
      const p = this.state.players.find((x) => x.id === playerId);
      if (!p || p.diceValue === null) return [];
      if (this.state.players[this.state.currentTurn]?.id !== playerId) {
        return [];
      }
      return this.getAvailableMovesWithDice(playerId, p.diceValue);
    }
    if (!this.state.diceValue) return [];
    if (this.state.players[this.state.currentTurn]?.id !== playerId) return [];
    return this.getAvailableMovesWithDice(playerId, this.state.diceValue);
  }

  private getAvailableMovesWithDice(
    playerId: string,
    diceValue: number
  ): number[] {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return [];
    const availablePieces: number[] = [];
    player.pieces.forEach((piece) => {
      if (piece.isHome && diceValue === 6) {
        availablePieces.push(piece.id);
      } else if (!piece.isHome && !piece.isFinished) {
        const newPosition = this.calculateNewPosition(
          player.color,
          piece.position,
          diceValue
        );
        if (newPosition !== null) availablePieces.push(piece.id);
      }
    });
    return availablePieces;
  }
}
