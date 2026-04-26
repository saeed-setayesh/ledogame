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

    // If player hasn't rolled, roll the dice
    if (!player.hasRolled || !gameState.diceValue) {
      return { action: "roll" };
    }

    const diceValue = gameState.diceValue;
    const availableMoves = engine.getAvailableMoves(playerId);

    if (availableMoves.length === 0) {
      // No moves available, skip turn (shouldn't happen but handle it)
      return { action: "roll" };
    }

    // Get the best move
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

    // Strategy priorities:
    // 1. If rolled 6 and have pieces in home, get one out
    // 2. Capture opponent pieces (land on them)
    // 3. Move pieces closer to finish
    // 4. Avoid unsafe positions

    // Priority 1: Get pieces out of home if rolled 6
    if (diceValue === 6) {
      const homePieces = pieces.filter((p) => p.isHome);
      if (homePieces.length > 0) {
        return homePieces[0].id;
      }
    }

    // Priority 2: Try to capture opponent pieces
    const captureMoves = this.findCaptureMoves(
      player,
      gameState,
      pieces,
      diceValue
    );
    if (captureMoves.length > 0) {
      return captureMoves[0].pieceId;
    }

    // Priority 3: Move pieces that are furthest along (closer to finish)
    const furthestPiece = this.findFurthestPiece(pieces, player.color);
    if (furthestPiece) {
      return furthestPiece.id;
    }

    // Default: return first available piece
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

      // Calculate new position
      const path = this.getColorPath(player.color);
      const currentIndex = path.indexOf(piece.position);
      if (currentIndex === -1) continue;

      const newIndex = currentIndex + diceValue;
      if (newIndex >= path.length) continue;

      const newPosition = path[newIndex];

      // Check if this position has opponent pieces (and not safe)
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
          // Score based on how close to finish (higher score for capturing)
          const score = 100 + (path.length - newIndex);
          captureMoves.push({ pieceId: piece.id, score });
        }
      }
    }

    // Sort by score (highest first)
    return captureMoves.sort((a, b) => b.score - a.score);
  }

  /**
   * Find the piece that is furthest along the path
   */
  private static findFurthestPiece(
    pieces: GamePiece[],
    color: string
  ): GamePiece | null {
    const path = this.getColorPath(color as any);
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

  /**
   * Check if a user ID is an AI player
   */
  static isAIPlayer(userId: string): boolean {
    return userId.startsWith("AI_");
  }

  /**
   * Generate AI user ID
   */
  static generateAIUserId(index: number = 0): string {
    return `AI_${index}`;
  }

  /**
   * Get AI username
   */
  static getAIUsername(userId: string): string {
    const match = userId.match(/AI_(\d+)/);
    const index = match ? parseInt(match[1]) : 0;
    const names = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta"];
    return names[index % names.length];
  }
}
