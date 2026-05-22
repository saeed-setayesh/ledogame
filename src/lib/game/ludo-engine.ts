export type PlayerColor = "RED" | "BLUE" | "GREEN" | "YELLOW";
export type GameModeType = "CLASSIC" | "RUSH";

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
  /** RUSH: rolled and must pick a piece before rolling again. */
  mustMove: boolean;
  /** Per-player roll; in CLASSIC only the current player has a value after rolling (mirrors diceValue). */
  diceValue: number | null;
}

export interface LudoGameState {
  players: Player[];
  currentTurn: number;
  diceValue: number | null;
  gameMode: GameModeType;
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
  const s = raw as Partial<LudoGameState> & {
    rushPhase?: string;
    rushRoundSeatsDone?: boolean[];
  };
  const gameMode: GameModeType =
    s.gameMode === "RUSH" ? "RUSH" : "CLASSIC";
  const players = (s.players || []).map((p: Player) => ({
    ...p,
    diceValue:
      typeof p.diceValue === "number" ? p.diceValue : null,
    hasRolled: !!p.hasRolled,
    canMove: !!p.canMove,
    mustMove:
      typeof p.mustMove === "boolean"
        ? p.mustMove
        : gameMode === "RUSH" &&
            !!p.hasRolled &&
            typeof p.diceValue === "number" &&
            p.canMove,
  }));
  return {
    players,
    currentTurn: typeof s.currentTurn === "number" ? s.currentTurn : 0,
    diceValue:
      s.diceValue !== undefined && s.diceValue !== null ? s.diceValue : null,
    gameMode,
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
      mustMove: false,
      diceValue: null,
    }));

    return {
      players: gamePlayers,
      currentTurn: 0,
      diceValue: null,
      gameMode,
      gameStatus: "ACTIVE",
      winnerId: null,
      turnEndsAt: null,
      lastMove: null,
    };
  }

  rollDice(playerId: string): number {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not found");

    if (this.state.gameMode === "RUSH") {
      if (player.mustMove) {
        throw new Error("You must move a piece before rolling again");
      }
      if (player.hasRolled) {
        throw new Error("You have already rolled the dice");
      }

      const diceValue = Math.floor(Math.random() * 6) + 1;
      player.diceValue = diceValue;
      player.hasRolled = true;
      const moves = this.getAvailableMovesWithDice(player.id, diceValue);
      player.canMove = moves.length > 0;
      player.mustMove = moves.length > 0;
      if (!player.mustMove) {
        this.resetRushPlayerAction(player);
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

  private resetRushPlayerAction(player: Player): void {
    player.hasRolled = false;
    player.canMove = false;
    player.mustMove = false;
    player.diceValue = null;
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
      if (!player.hasRolled || !player.mustMove || player.diceValue === null) {
        throw new Error("You must roll the dice first");
      }
      const diceValue = player.diceValue;
      return this.applyMove(player, pieceId, diceValue, () => {
        this.resetRushPlayerAction(player);
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
    if (this.state.gameMode === "RUSH") {
      return player.pieces.some((piece) => piece.isFinished);
    }
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
      const player = this.state.players[this.state.currentTurn];
      if (player?.mustMove) {
        this.resetRushPlayerAction(player);
      }
      return;
    }
    if (this.state.diceValue === null) {
      this.nextTurnClassic();
    }
  }

  forceNextTurn(): void {
    if (this.state.gameMode === "RUSH") {
      return;
    }
    this.nextTurnClassic();
  }

  /** RUSH: skip a timed-out player who rolled but did not move. */
  forceRushSkip(playerId: string): void {
    if (this.state.gameMode !== "RUSH") return;
    const player = this.state.players.find((p) => p.id === playerId);
    if (player?.mustMove) {
      this.resetRushPlayerAction(player);
    }
  }

  getAvailableMoves(playerId: string): number[] {
    if (this.state.gameMode === "RUSH") {
      const p = this.state.players.find((x) => x.id === playerId);
      if (!p || !p.hasRolled || !p.mustMove || p.diceValue === null) {
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
