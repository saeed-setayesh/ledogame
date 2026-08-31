export type PlayerColor = "RED" | "BLUE" | "GREEN" | "YELLOW";
export type GameModeType = "CLASSIC" | "RUSH";

import {
  FINISH_PROGRESS,
  OUTER_TRACK_LENGTH,
  SAFE_OUTER_TRACK_INDICES,
  outerIndexToPathPosition,
  pathPositionToOuterIndex,
} from "./ludo-track-cells";

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
  /**
   * Consecutive rolls this player has made while completely locked in base
   * (all four pieces home) without rolling a six. Drives the "mercy" dice
   * assist so a player can't be permanently stuck out of the game.
   */
  baseStuckStreak: number;
}

export interface LudoGameState {
  positionModel?: "COLOR_PROGRESS_V1";
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
    /** true when this move sent an opponent piece back home */
    captured: boolean;
    /** true when this move earns the player another roll (six / capture / reached home) */
    bonusRoll: boolean;
  } | null;
}

const START_PROGRESS = 0;

export function normalizeGameState(raw: unknown): LudoGameState {
  const s = raw as Partial<LudoGameState> & {
    rushPhase?: string;
    rushRoundSeatsDone?: boolean[];
  };
  const gameMode: GameModeType =
    s.gameMode === "RUSH" ? "RUSH" : "CLASSIC";
  const isModernPositionModel = s.positionModel === "COLOR_PROGRESS_V1";
  const players = (s.players || []).map((p: Player) => ({
    ...p,
    pieces: (p.pieces || []).map((piece) => ({
      ...piece,
      position:
        !isModernPositionModel &&
        !piece.isHome &&
        !piece.isFinished &&
        piece.position >= 0 &&
        piece.position < OUTER_TRACK_LENGTH
          ? outerIndexToPathPosition(p.color, piece.position) ?? piece.position
          : piece.position,
    })),
    diceValue:
      typeof p.diceValue === "number" ? p.diceValue : null,
    hasRolled: !!p.hasRolled,
    canMove: !!p.canMove,
    baseStuckStreak:
      typeof p.baseStuckStreak === "number" && p.baseStuckStreak >= 0
        ? p.baseStuckStreak
        : 0,
    mustMove:
      typeof p.mustMove === "boolean"
        ? p.mustMove
        : gameMode === "RUSH" &&
            !!p.hasRolled &&
            typeof p.diceValue === "number" &&
            p.canMove,
  }));
  return {
    positionModel: "COLOR_PROGRESS_V1",
    players,
    currentTurn: typeof s.currentTurn === "number" ? s.currentTurn : 0,
    diceValue:
      s.diceValue !== undefined && s.diceValue !== null ? s.diceValue : null,
    gameMode,
    gameStatus: s.gameStatus === "FINISHED" ? "FINISHED" : s.gameStatus === "WAITING" ? "WAITING" : "ACTIVE",
    winnerId: s.winnerId ?? null,
    turnEndsAt: s.turnEndsAt ?? null,
    lastMove: s.lastMove
      ? {
          playerId: s.lastMove.playerId,
          diceRoll: s.lastMove.diceRoll,
          pieceMoved: s.lastMove.pieceMoved ?? null,
          fromPosition: s.lastMove.fromPosition,
          toPosition: s.lastMove.toPosition,
          captured: !!s.lastMove.captured,
          bonusRoll: !!s.lastMove.bonusRoll,
        }
      : null,
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
      baseStuckStreak: 0,
    }));

    return {
      positionModel: "COLOR_PROGRESS_V1",
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

      const diceValue = this.rollDiceValue(player);
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

    const diceValue = this.rollDiceValue(player);
    this.state.diceValue = diceValue;
    player.diceValue = diceValue;
    player.hasRolled = true;
    player.canMove = this.canPlayerMove(player, diceValue);
    return diceValue;
  }

  /**
   * Roll a die for a player. Fair 1/6 odds normally, but when a player has been
   * stuck with all four pieces in base for several turns the chance of a six is
   * quietly raised so they can get into the game. The ramp is gradual (never a
   * guaranteed six) and the exact same rule applies to every player, human or
   * AI — so it reads as a house "mercy" rule, not a script.
   */
  private rollDiceValue(player: Player): number {
    const lockedInBase = player.pieces.every((p) => p.isHome);
    const streak = lockedInBase ? player.baseStuckStreak : 0;

    let value: number;
    if (streak >= 2) {
      // streak 2 → ~32%, 3 → ~47%, 4 → ~62%, 5 → ~77%, 6+ → capped 85%
      const sixChance = Math.min(0.85, 1 / 6 + (streak - 1) * 0.15);
      value =
        Math.random() < sixChance ? 6 : Math.floor(Math.random() * 5) + 1;
    } else {
      value = Math.floor(Math.random() * 6) + 1;
    }

    if (value === 6 || !lockedInBase) {
      player.baseStuckStreak = 0;
    } else {
      player.baseStuckStreak += 1;
    }
    return value;
  }

  private resetRushPlayerAction(player: Player): void {
    player.hasRolled = false;
    player.canMove = false;
    player.mustMove = false;
    player.diceValue = null;
  }

  private canPlayerMove(player: Player, diceValue: number): boolean {
    return player.pieces.some((piece) => {
      if (piece.isHome && diceValue === 6) return true;
      if (!piece.isHome && !piece.isFinished) {
        return this.calculateNewPosition(piece.position, diceValue) !== null;
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
    return this.applyMove(player, pieceId, diceValue, ({ captured, finishedNow }) => {
      // Bonus roll: rolling a six, capturing an opponent, or getting a piece home.
      const bonusRoll = diceValue === 6 || captured || finishedNow;
      if (this.state.lastMove) this.state.lastMove.bonusRoll = bonusRoll;
      if (bonusRoll) {
        player.hasRolled = false;
        player.canMove = false;
        player.diceValue = null;
        this.state.diceValue = null;
      } else {
        this.nextTurnClassic();
      }
    });
  }

  private applyMove(
    player: Player,
    pieceId: number,
    diceValue: number,
    afterMove: (info: { captured: boolean; finishedNow: boolean }) => void
  ): boolean {
    const piece = player.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error("Piece not found");
    const fromPosition = piece.position;

    let finishedNow = false;
    if (piece.isHome && diceValue === 6) {
      piece.isHome = false;
      piece.position = START_PROGRESS;
    } else if (!piece.isHome && !piece.isFinished) {
      const newPosition = this.calculateNewPosition(piece.position, diceValue);
      if (newPosition === null) throw new Error("Invalid move");
      piece.position = newPosition;
      if (this.isPieceFinished(newPosition)) {
        piece.isFinished = true;
        finishedNow = true;
        piece.position = 100 + piece.id;
      }
    } else {
      throw new Error("Invalid move");
    }

    const capturedCount = this.checkCaptures(player, piece);
    const captured = capturedCount > 0;
    this.state.lastMove = {
      playerId: player.id,
      diceRoll: diceValue,
      pieceMoved: pieceId,
      fromPosition,
      toPosition: piece.position,
      captured,
      bonusRoll: false,
    };

    if (this.checkWin(player)) {
      this.state.gameStatus = "FINISHED";
      this.state.winnerId = player.userId;
      this.state.turnEndsAt = null;
      return true;
    }

    afterMove({ captured, finishedNow });
    return false;
  }

  private calculateNewPosition(
    currentPosition: number,
    diceValue: number
  ): number | null {
    if (currentPosition === -1) return null;
    if (currentPosition < 0 || currentPosition >= FINISH_PROGRESS) return null;
    const nextPosition = currentPosition + diceValue;
    if (nextPosition > FINISH_PROGRESS) return null;
    return nextPosition;
  }

  private isPieceFinished(position: number): boolean {
    return position === FINISH_PROGRESS;
  }

  /** Returns the number of opponent pieces sent back home by this move. */
  private checkCaptures(player: Player, movedPiece: GamePiece): number {
    const movedOuterIndex = pathPositionToOuterIndex(
      player.color,
      movedPiece.position
    );
    if (
      movedOuterIndex === null ||
      SAFE_OUTER_TRACK_INDICES.has(movedOuterIndex)
    ) {
      return 0;
    }

    let captured = 0;
    this.state.players.forEach((opponent) => {
      if (opponent.id === player.id) return;
      opponent.pieces.forEach((opponentPiece) => {
        const opponentOuterIndex = pathPositionToOuterIndex(
          opponent.color,
          opponentPiece.position
        );
        if (
          !opponentPiece.isHome &&
          !opponentPiece.isFinished &&
          opponentOuterIndex === movedOuterIndex
        ) {
          opponentPiece.isHome = true;
          opponentPiece.position = -1;
          captured += 1;
        }
      });
    });
    return captured;
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

  /**
   * Turn-timer fallback: play a timed-out player's turn automatically so the
   * game keeps moving. Rolls if needed, then moves a sensible piece, or skips.
   */
  autoAdvanceForTimeout(playerId: string): {
    rolled: number | null;
    movedPiece: number | null;
    finished: boolean;
    skipped: boolean;
  } {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { rolled: null, movedPiece: null, finished: false, skipped: false };

    if (this.state.gameMode === "RUSH") {
      if (player.mustMove && player.diceValue !== null) {
        const moves = this.getAvailableMovesWithDice(playerId, player.diceValue);
        if (moves.length > 0) {
          const pieceId = this.pickTimeoutPiece(player, moves, player.diceValue);
          const finished = this.movePiece(playerId, pieceId);
          return { rolled: null, movedPiece: pieceId, finished, skipped: false };
        }
        this.forceRushSkip(playerId);
        return { rolled: null, movedPiece: null, finished: false, skipped: true };
      }
      return { rolled: null, movedPiece: null, finished: false, skipped: false };
    }

    // CLASSIC
    if (this.state.players[this.state.currentTurn]?.id !== playerId) {
      return { rolled: null, movedPiece: null, finished: false, skipped: false };
    }

    let rolled: number | null = null;
    if (!player.hasRolled || this.state.diceValue === null) {
      rolled = this.rollDice(playerId);
    }

    const dice = this.state.diceValue;
    if (dice === null) {
      this.nextTurnClassic();
      return { rolled, movedPiece: null, finished: false, skipped: true };
    }

    const moves = this.getAvailableMovesWithDice(playerId, dice);
    if (moves.length === 0) {
      this.nextTurnClassic();
      return { rolled, movedPiece: null, finished: false, skipped: true };
    }

    const pieceId = this.pickTimeoutPiece(player, moves, dice);
    const finished = this.movePiece(playerId, pieceId);
    return { rolled, movedPiece: pieceId, finished, skipped: false };
  }

  private pickTimeoutPiece(
    player: Player,
    moves: number[],
    diceValue: number
  ): number {
    const candidates = player.pieces.filter((p) => moves.includes(p.id));
    if (candidates.length === 0) return moves[0];
    if (diceValue === 6) {
      const homePiece = candidates.find((p) => p.isHome);
      if (homePiece) return homePiece.id;
    }
    // Otherwise advance the piece that is furthest along.
    const onBoard = candidates.filter((p) => !p.isHome && !p.isFinished);
    if (onBoard.length > 0) {
      return onBoard.reduce((a, b) => (b.position > a.position ? b : a)).id;
    }
    return candidates[0].id;
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
        const newPosition = this.calculateNewPosition(piece.position, diceValue);
        if (newPosition !== null) availablePieces.push(piece.id);
      }
    });
    return availablePieces;
  }
}
