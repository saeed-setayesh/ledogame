export type PlayerColor = "RED" | "BLUE" | "GREEN" | "YELLOW";

export interface GamePiece {
  id: number;
  position: number; // -1 = home, 0-51 = on board, 100+ = finished
  color: PlayerColor;
  isHome: boolean;
  isFinished: boolean;
}

export interface Player {
  id: string;
  userId: string;
  color: PlayerColor;
  position: number; // Player order (0-3)
  pieces: GamePiece[];
  hasRolled: boolean;
  canMove: boolean;
}

export interface LudoGameState {
  players: Player[];
  currentTurn: number; // Index of current player
  diceValue: number | null;
  gameStatus: "WAITING" | "ACTIVE" | "FINISHED";
  winnerId: string | null;
  lastMove: {
    playerId: string;
    diceRoll: number;
    pieceMoved: number | null;
    fromPosition: number;
    toPosition: number;
  } | null;
}

// Board positions for each color's path
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

// Safe positions (cannot be captured)
const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];

// Starting positions for each color
const START_POSITIONS: Record<PlayerColor, number> = {
  RED: 0,
  BLUE: 13,
  GREEN: 26,
  YELLOW: 39,
};

export class LudoEngine {
  private state: LudoGameState;

  constructor(
    players: {
      id: string;
      userId: string;
      color: PlayerColor;
      position: number;
    }[]
  ) {
    this.state = this.initializeGame(players);
  }

  private initializeGame(
    players: {
      id: string;
      userId: string;
      color: PlayerColor;
      position: number;
    }[]
  ): LudoGameState {
    const gamePlayers: Player[] = players.map((p) => ({
      id: p.id,
      userId: p.userId,
      color: p.color,
      position: p.position,
      pieces: Array.from({ length: 4 }, (_, i) => ({
        id: i,
        position: -1, // -1 means in home
        color: p.color,
        isHome: true,
        isFinished: false,
      })),
      hasRolled: false,
      canMove: false,
    }));

    return {
      players: gamePlayers,
      currentTurn: 0,
      diceValue: null,
      gameStatus: "ACTIVE",
      winnerId: null,
      lastMove: null,
    };
  }

  getState(): LudoGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  rollDice(playerId: string): number {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const currentPlayer = this.state.players[this.state.currentTurn];
    if (currentPlayer.id !== playerId) {
      throw new Error("Not your turn");
    }

    if (player.hasRolled) {
      throw new Error("You have already rolled the dice");
    }

    // Roll dice (1-6)
    const diceValue = Math.floor(Math.random() * 6) + 1;
    this.state.diceValue = diceValue;
    player.hasRolled = true;

    // Check if player can move
    player.canMove = this.canPlayerMove(player, diceValue);

    return diceValue;
  }

  private canPlayerMove(player: Player, diceValue: number): boolean {
    // If rolled 6, can bring piece out or move
    if (diceValue === 6) {
      return true;
    }

    // Check if any piece can move
    return player.pieces.some((piece) => {
      if (piece.isHome && diceValue === 6) {
        return true;
      }
      if (!piece.isHome && !piece.isFinished) {
        const newPosition = this.calculateNewPosition(
          player.color,
          piece.position,
          diceValue
        );
        return newPosition !== null;
      }
      return false;
    });
  }

  movePiece(playerId: string, pieceId: number): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const currentPlayer = this.state.players[this.state.currentTurn];
    if (currentPlayer.id !== playerId) {
      throw new Error("Not your turn");
    }

    if (!player.hasRolled || !this.state.diceValue) {
      throw new Error("You must roll the dice first");
    }

    const piece = player.pieces.find((p) => p.id === pieceId);
    if (!piece) {
      throw new Error("Piece not found");
    }

    const diceValue = this.state.diceValue;
    const fromPosition = piece.position;

    // Move piece
    if (piece.isHome && diceValue === 6) {
      // Bring piece out
      piece.isHome = false;
      piece.position = START_POSITIONS[player.color];
    } else if (!piece.isHome && !piece.isFinished) {
      // Move piece on board
      const newPosition = this.calculateNewPosition(
        player.color,
        piece.position,
        diceValue
      );
      if (newPosition === null) {
        throw new Error("Invalid move");
      }

      piece.position = newPosition;

      // Check if piece reached home (finished)
      if (this.isPieceFinished(player.color, newPosition)) {
        piece.isFinished = true;
        piece.position = 100 + piece.id; // Mark as finished
      }
    } else {
      throw new Error("Invalid move");
    }

    // Check for captures
    this.checkCaptures(player, piece);

    // Record move
    this.state.lastMove = {
      playerId,
      diceRoll: diceValue,
      pieceMoved: pieceId,
      fromPosition,
      toPosition: piece.position,
    };

    // Check for win
    if (this.checkWin(player)) {
      this.state.gameStatus = "FINISHED";
      this.state.winnerId = player.userId;
      return true;
    }

    // If rolled 6, player gets another turn
    if (diceValue !== 6) {
      this.nextTurn();
    } else {
      // Reset for another roll
      player.hasRolled = false;
      player.canMove = false;
    }

    return false;
  }

  private calculateNewPosition(
    color: PlayerColor,
    currentPosition: number,
    diceValue: number
  ): number | null {
    if (currentPosition === -1) {
      return null; // Piece is home
    }

    const path = COLOR_PATHS[color];
    const currentIndex = path.indexOf(currentPosition);

    if (currentIndex === -1) {
      return null;
    }

    const newIndex = currentIndex + diceValue;

    // Check if piece would go beyond finish
    if (newIndex >= path.length) {
      return null;
    }

    return path[newIndex];
  }

  private isPieceFinished(color: PlayerColor, position: number): boolean {
    const path = COLOR_PATHS[color];
    return position === path[path.length - 1];
  }

  private checkCaptures(player: Player, movedPiece: GamePiece): void {
    // Check if this piece captured any opponent pieces
    this.state.players.forEach((opponent) => {
      if (opponent.id === player.id) return;

      opponent.pieces.forEach((opponentPiece) => {
        if (
          !opponentPiece.isHome &&
          !opponentPiece.isFinished &&
          opponentPiece.position === movedPiece.position &&
          !SAFE_POSITIONS.includes(movedPiece.position)
        ) {
          // Capture! Send piece back home
          opponentPiece.isHome = true;
          opponentPiece.position = -1;
        }
      });
    });
  }

  private checkWin(player: Player): boolean {
    return player.pieces.every((piece) => piece.isFinished);
  }

  private nextTurn(): void {
    this.state.currentTurn =
      (this.state.currentTurn + 1) % this.state.players.length;
    const currentPlayer = this.state.players[this.state.currentTurn];
    currentPlayer.hasRolled = false;
    currentPlayer.canMove = false;
    this.state.diceValue = null;
  }

  skipTurn(): void {
    if (this.state.diceValue === null) {
      this.nextTurn();
    }
  }

  forceNextTurn(): void {
    // Force advance to next turn regardless of dice value
    this.nextTurn();
  }

  getAvailableMoves(playerId: string): number[] {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !this.state.diceValue) {
      return [];
    }

    const diceValue = this.state.diceValue;
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
        if (newPosition !== null) {
          availablePieces.push(piece.id);
        }
      }
    });

    return availablePieces;
  }
}
