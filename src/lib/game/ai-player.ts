import { LudoEngine, LudoGameState, Player, GamePiece } from "./ludo-engine";
import {
  FINISH_PROGRESS,
  SAFE_OUTER_TRACK_INDICES,
  pathPositionToOuterIndex,
} from "./ludo-track-cells";

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

    const furthestPiece = this.findFurthestPiece(pieces);
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
    for (const piece of availablePieces) {
      if (piece.isHome) continue;

      const newPosition = piece.position + diceValue;
      if (newPosition > FINISH_PROGRESS) continue;
      const newOuterIndex = pathPositionToOuterIndex(player.color, newPosition);
      if (
        newOuterIndex === null ||
        SAFE_OUTER_TRACK_INDICES.has(newOuterIndex)
      ) {
        continue;
      }

      const hasOpponent = gameState.players.some((opponent) => {
        if (opponent.id === player.id) return false;
        return opponent.pieces.some((oppPiece) => {
          if (oppPiece.isHome || oppPiece.isFinished) return false;
          return (
            pathPositionToOuterIndex(opponent.color, oppPiece.position) ===
            newOuterIndex
          );
        });
      });

      if (hasOpponent) {
        const score = 100 + (FINISH_PROGRESS - newPosition);
        captureMoves.push({ pieceId: piece.id, score });
      }
    }

    return captureMoves.sort((a, b) => b.score - a.score);
  }

  /**
   * Find the piece that is furthest along the path
   */
  private static findFurthestPiece(pieces: GamePiece[]): GamePiece | null {
    let furthestPiece: GamePiece | null = null;
    let furthestIndex = -1;

    for (const piece of pieces) {
      if (piece.isHome || piece.isFinished) continue;

      const index = piece.position;
      if (index > furthestIndex) {
        furthestIndex = index;
        furthestPiece = piece;
      }
    }

    return furthestPiece || pieces[0] || null;
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
