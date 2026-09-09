import { prisma } from "@/lib/prisma";
import { generateRoomId } from "@/lib/utils";
import { AIPlayer } from "@/lib/game/ai-player";
import { collectEntryFeesAndStartGame } from "@/lib/wallet/game-payments";

/** Games older than this are never matched into (stale / abandoned lobbies). */
const MATCH_WINDOW_MS = 5 * 60 * 1000;

export type MatchmakeResult =
  | { status: "matched"; gameId: string }
  | { status: "searching"; gameId: string }
  | { status: "error"; message: string };

type MatchGame = {
  id: string;
  createdAt: Date;
  status: string;
  players: { userId: string; status: string }[];
};

function isMatchmakingShape(g: {
  gameType: string;
  maxPlayers: number;
  players: { userId: string }[];
}) {
  return (
    g.gameType === "SOLO" &&
    g.maxPlayers === 2 &&
    !g.players.some((p) => AIPlayer.isAIPlayer(p.userId))
  );
}

/**
 * DB-backed 2-player matchmaking. The client polls this endpoint; each call
 * either pairs the user into an opponent's open lobby (and starts the game) or
 * keeps them in their own open lobby waiting. Two users racing to create a
 * lobby converge because whoever holds the *newer* lobby joins the older one.
 */
export async function matchmake(
  userId: string,
  entryFee: number,
  gameMode: "CLASSIC" | "RUSH"
): Promise<MatchmakeResult> {
  const cutoff = new Date(Date.now() - MATCH_WINDOW_MS);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  });
  if (!user) return { status: "error", message: "User not found" };
  if (parseFloat(user.walletBalance.toString()) < entryFee) {
    return { status: "error", message: "Insufficient balance" };
  }

  // 1. Do I already have a matchmaking lobby / game in flight?
  const mine = await prisma.game.findFirst({
    where: {
      creatorId: userId,
      gameType: "SOLO",
      maxPlayers: 2,
      gameMode,
      entryFee,
      status: { in: ["WAITING", "ACTIVE"] },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
    include: { players: { select: { userId: true, status: true } } },
  });

  if (mine && mine.status === "ACTIVE") {
    return { status: "matched", gameId: mine.id };
  }

  // 2. Look for an opponent's open lobby.
  const openLobbies = await prisma.game.findMany({
    where: {
      status: "WAITING",
      gameType: "SOLO",
      maxPlayers: 2,
      gameMode,
      entryFee,
      creatorId: { not: userId },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    include: { players: { select: { userId: true, status: true } } },
  });

  const opponent = openLobbies.find(
    (g) =>
      g.players.length === 1 &&
      !AIPlayer.isAIPlayer(g.players[0].userId) &&
      g.players[0].userId !== userId
  ) as MatchGame | undefined;

  const shouldJoinOpponent =
    opponent &&
    (!mine ||
      opponent.createdAt.getTime() < mine.createdAt.getTime() ||
      (opponent.createdAt.getTime() === mine.createdAt.getTime() &&
        opponent.id < mine.id));

  if (opponent && shouldJoinOpponent) {
    const joined = await joinLobby(opponent.id, userId).catch(() => false);
    if (joined) {
      if (mine) {
        await prisma.gamePlayer
          .deleteMany({ where: { gameId: mine.id, userId } })
          .catch(() => {});
        await prisma.game
          .update({
            where: { id: mine.id },
            data: { status: "CANCELLED", finishedAt: new Date() },
          })
          .catch(() => {});
      }
      try {
        await collectEntryFeesAndStartGame(opponent.id);
      } catch (e) {
        return {
          status: "error",
          message: e instanceof Error ? e.message : "Could not start game",
        };
      }
      return { status: "matched", gameId: opponent.id };
    }
  }

  if (mine && mine.status === "WAITING") {
    return { status: "searching", gameId: mine.id };
  }

  // 3. Create a fresh lobby and wait.
  const game = await prisma.game.create({
    data: {
      roomId: generateRoomId(),
      gameType: "SOLO",
      gameMode,
      maxPlayers: 2,
      entryFee,
      creatorId: userId,
      status: "WAITING",
      players: {
        create: { userId, position: 0, color: "RED", status: "ACTIVE" },
      },
    },
  });
  return { status: "searching", gameId: game.id };
}

/** Atomically add a 2nd player to a still-open lobby. */
async function joinLobby(gameId: string, userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { players: { select: { id: true, userId: true } } },
    });
    if (!game || game.status !== "WAITING") return false;
    if (game.players.length >= game.maxPlayers) return false;
    if (game.players.some((p) => p.userId === userId)) return true;

    await tx.gamePlayer.create({
      data: {
        gameId,
        userId,
        position: game.players.length,
        color: "BLUE",
        status: "ACTIVE",
      },
    });
    return true;
  });
}

/** Cancel the caller's open matchmaking lobby (client pressed "stop searching"). */
export async function cancelMatchmaking(userId: string): Promise<void> {
  const mine = await prisma.game.findMany({
    where: {
      creatorId: userId,
      gameType: "SOLO",
      maxPlayers: 2,
      status: "WAITING",
    },
    select: { id: true },
  });
  for (const g of mine) {
    await prisma.game
      .update({
        where: { id: g.id },
        data: { status: "CANCELLED", finishedAt: new Date() },
      })
      .catch(() => {});
  }
}
