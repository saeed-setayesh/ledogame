import { prisma } from "@/lib/prisma";
import {
  LudoEngine,
  LudoGameState,
  normalizeGameState,
  type GameModeType,
  type PlayerColor,
} from "./ludo-engine";

const activeGames = new Map<
  string,
  { engine: LudoEngine; state: LudoGameState }
>();

/** Countdown for roll/move; server stamps on each persisted state update. */
export const TURN_COUNTDOWN_MS = 45_000;

export function stampTurnDeadline(state: LudoGameState): LudoGameState {
  if (state.gameStatus !== "ACTIVE") {
    return { ...state, turnEndsAt: null };
  }
  return {
    ...state,
    turnEndsAt: new Date(Date.now() + TURN_COUNTDOWN_MS).toISOString(),
  };
}

export async function createGameState(
  gameId: string,
  players: { id: string; userId: string; color: string; position: number }[],
  gameMode: GameModeType = "CLASSIC"
) {
  const engine = new LudoEngine(
    players.map((p) => ({
      id: p.id,
      userId: p.userId,
      color: p.color as PlayerColor,
      position: p.position,
    })),
    gameMode
  );
  const state = stampTurnDeadline(engine.getState());

  activeGames.set(gameId, { engine, state });

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
    const stamped = stampTurnDeadline(state);
    game.state = stamped;
    game.engine.setState(stamped);
    await prisma.game.update({
      where: { id: gameId },
      data: {
        gameState: stamped as any,
        currentTurn: stamped.currentTurn,
        diceValue: stamped.diceValue,
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

  const players = game.players.map((p) => ({
    id: p.id,
    userId: p.userId,
    color: p.color as PlayerColor,
    position: p.position,
  }));

  const modeFromDb: GameModeType =
    game.gameMode === "RUSH" ? "RUSH" : "CLASSIC";

  if (game.gameState) {
    const raw = { ...(game.gameState as object) } as Record<string, unknown>;
    if (!raw.gameMode) raw.gameMode = modeFromDb;
    const normalized = normalizeGameState(raw);
    if (normalized.players.length === players.length) {
      const engine = new LudoEngine(players, normalized.gameMode);
      engine.setState(normalized);
      const state = stampTurnDeadline(engine.getState());
      activeGames.set(gameId, { engine, state });
      return state;
    }
  }

  const engine = new LudoEngine(players, modeFromDb);
  const state = stampTurnDeadline(engine.getState());
  activeGames.set(gameId, { engine, state });

  return state;
}

export function removeGame(gameId: string) {
  activeGames.delete(gameId);
}
