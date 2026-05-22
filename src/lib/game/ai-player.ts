import { LudoEngine, LudoGameState, Player, GamePiece } from "./ludo-engine";

export interface AIDecision {
  action: "roll" | "move";
  pieceId?: number;
}

/**
 * AI Player Service
 * Makes intelligent decisions for AI players in Ludo games
 */
export class AIPlayer {
  /**
   * Make a decision for the AI player
   * Strategy:
   * 1. If dice not rolled, roll it
   * 2. If rolled 6, prioritize getting pieces out
   * 3. Prioritize capturing opponent pieces
   * 4. Move pieces closer to finish
   * 5. Avoid unsafe positions when possible
   */
  static makeDecision(
    engine: LudoEngine,
    gameState: LudoGameState,
    playerId: string
  ): AIDecision {
    const player = gameState.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    if (gameState.gameMode === "RUSH") {
      if (player.mustMove && player.diceValue !== null) {
        const availableMoves = engine.getAvailableMoves(playerId);
        if (availableMoves.length === 0) {
          return { action: "roll" };
        }
        const bestPieceId = this.selectBestPiece(
          player,
          gameState,
          availableMoves,
          player.diceValue
        );
        return { action: "move", pieceId: bestPieceId };
      }
      if (!player.hasRolled) {
        return { action: "roll" };
      }
      return { action: "roll" };
    }

    if (!player.hasRolled || !gameState.diceValue) {
      return { action: "roll" };
    }

    const diceValue = gameState.diceValue;
    const availableMoves = engine.getAvailableMoves(playerId);

    if (availableMoves.length === 0) {
      return { action: "roll" };
    }

    const bestPieceId = this.selectBestPiece(
      player,
      gameState,
      availableMoves,
      diceValue
    );

    return {
      action: "move",
      pieceId: bestPieceId,
    };
  }

  /**
   * Select the best piece to move based on strategy
   */
  private static selectBestPiece(
    player: Player,
    gameState: LudoGameState,
    availableMoves: number[],
    diceValue: number
  ): number {
    const pieces = player.pieces.filter((p) => availableMoves.includes(p.id));

    if (pieces.length === 0) {
      return availableMoves[0];
    }

    if (diceValue === 6) {
      const homePieces = pieces.filter((p) => p.isHome);
      if (homePieces.length > 0) {
        return homePieces[0].id;
      }
    }

    const captureMoves = this.findCaptureMoves(
      player,
      gameState,
      pieces,
      diceValue
    );
    if (captureMoves.length > 0) {
      return captureMoves[0].pieceId;
    }

    const furthestPiece = this.findFurthestPiece(pieces, player.color);
    if (furthestPiece) {
      return furthestPiece.id;
    }

    return pieces[0].id;
  }

  /**
   * Find moves that can capture opponent pieces
   */
  private static findCaptureMoves(
    player: Player,
    gameState: LudoGameState,
    availablePieces: GamePiece[],
    diceValue: number
  ): Array<{ pieceId: number; score: number }> {
    const captureMoves: Array<{ pieceId: number; score: number }> = [];
    const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];

    for (const piece of availablePieces) {
      if (piece.isHome) continue;

      const path = this.getColorPath(player.color);
      const currentIndex = path.indexOf(piece.position);
      if (currentIndex === -1) continue;

      const newIndex = currentIndex + diceValue;
      if (newIndex >= path.length) continue;

      const newPosition = path[newIndex];

      if (!SAFE_POSITIONS.includes(newPosition)) {
        const hasOpponent = gameState.players.some((opponent) => {
          if (opponent.id === player.id) return false;
          return opponent.pieces.some(
            (oppPiece) =>
              !oppPiece.isHome &&
              !oppPiece.isFinished &&
              oppPiece.position === newPosition
          );
        });

        if (hasOpponent) {
          const score = 100 + (path.length - newIndex);
          captureMoves.push({ pieceId: piece.id, score });
        }
      }
    }

    return captureMoves.sort((a, b) => b.score - a.score);
  }

  /**
   * Find the piece that is furthest along the path
   */
  private static findFurthestPiece(
    pieces: GamePiece[],
    color: string
  ): GamePiece | null {
    const path = this.getColorPath(color as Player["color"]);
    let furthestPiece: GamePiece | null = null;
    let furthestIndex = -1;

    for (const piece of pieces) {
      if (piece.isHome || piece.isFinished) continue;

      const index = path.indexOf(piece.position);
      if (index > furthestIndex) {
        furthestIndex = index;
        furthestPiece = piece;
      }
    }

    return furthestPiece || pieces[0] || null;
  }

  /**
   * Get the path for a color
   */
  private static getColorPath(color: string): number[] {
    const COLOR_PATHS: Record<string, number[]> = {
      RED: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
        38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
      ],
      BLUE: [
        13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        49, 50, 51, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ],
      GREEN: [
        26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
        44, 45, 46, 47, 48, 49, 50, 51, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
        12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      ],
      YELLOW: [
        39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 0, 1, 2, 3, 4, 5, 6,
        7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
      ],
    };

    return COLOR_PATHS[color] || [];
  }

  static isAIPlayer(userId: string): boolean {
    return userId.startsWith("AI_");
  }

  static generateAIUserId(index: number = 0): string {
    return `AI_${index}`;
  }

  static getAIUsername(userId: string): string {
    const match = userId.match(/AI_(\d+)/);
    const index = match ? parseInt(match[1]) : 0;
    const names = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta"];
    return names[index % names.length];
  }
}
