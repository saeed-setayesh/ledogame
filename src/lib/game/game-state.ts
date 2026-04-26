import { prisma } from "@/lib/prisma";
import { LudoEngine, LudoGameState } from "./ludo-engine";

// In-memory game state storage
const activeGames = new Map<
  string,
  { engine: LudoEngine; state: LudoGameState }
>();

export async function createGameState(
  gameId: string,
  players: { id: string; userId: string; color: string; position: number }[]
) {
  const engine = new LudoEngine(players);
  const state = engine.getState();

  activeGames.set(gameId, { engine, state });

  // Persist initial state to database
  await prisma.game.update({
    where: { id: gameId },
    data: {
      gameState: state as any,
    },
  });

  return state;
}

export function getGameState(gameId: string): LudoGameState | null {
  const game = activeGames.get(gameId);
  return game ? game.state : null;
}

export function getGameEngine(gameId: string): LudoEngine | null {
  const game = activeGames.get(gameId);
  return game ? game.engine : null;
}

export async function updateGameState(gameId: string, state: LudoGameState) {
  const game = activeGames.get(gameId);
  if (game) {
    game.state = state;
    // Persist to database for rejoin capability
    await prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: state as any,
        currentTurn: state.currentTurn,
        diceValue: state.diceValue,
      },
    });
  }
}

export async function loadGameFromDatabase(
  gameId: string
): Promise<LudoGameState | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          user: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!game) {
    return null;
  }

  // Recreate engine from players
  const players = game.players.map((p) => ({
    id: p.id,
    userId: p.userId,
    color: p.color as any,
    position: p.position,
  }));

  const engine = new LudoEngine(players);

  // If we have saved state, try to restore it
  if (game.gameState) {
    const savedState = game.gameState as any as LudoGameState;
    // Use saved state if it's valid and has the same number of players
    if (savedState.players && savedState.players.length === players.length) {
      activeGames.set(gameId, { engine, state: savedState });
      return savedState;
    }
  }

  // Otherwise use fresh state from engine
  const state = engine.getState();
  activeGames.set(gameId, { engine, state });

  return state;
}

export function removeGame(gameId: string) {
  activeGames.delete(gameId);
}
