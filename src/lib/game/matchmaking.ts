import { prisma } from "@/lib/prisma";
import { generateRoomId } from "@/lib/utils";
import { AIPlayer } from "@/lib/game/ai-player";
import { collectEntryFeesAndStartGame } from "@/lib/wallet/game-payments";

/** Lobbies older than this are treated as stale and cleaned up. */
const MATCH_WINDOW_MS = 3 * 60 * 1000;

export type MatchmakeResult =
  | { status: "matched"; gameId: string }
  | { status: "searching"; gameId: string }
  | { status: "error"; message: string };

const MM_SHAPE = { gameType: "SOLO", maxPlayers: 2 } as const;

/** Every WAITING/ACTIVE matchmaking game this user is a player in, newest first. */
async function myGames(userId: string) {
  return prisma.game.findMany({
    where: {
      ...MM_SHAPE,
      status: { in: ["WAITING", "ACTIVE"] },
      players: { some: { userId } },
    },
    orderBy: { createdAt: "desc" },
    include: { players: { select: { userId: true } } },
  });
}

async function cancelGame(gameId: string) {
  await prisma.game
    .update({
      where: { id: gameId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * DB-backed 2-player matchmaking. The client polls this (and also gets a socket
 * push from the server-side pairer). Guarantees **at most one open lobby per
 * user** and never points a user at a broken game.
 */
export async function matchmake(
  userId: string,
  entryFee: number,
  gameMode: "CLASSIC" | "RUSH"
): Promise<MatchmakeResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  });
  if (!user) return { status: "error", message: "User not found" };
  if (parseFloat(user.walletBalance.toString()) < entryFee) {
    return { status: "error", message: "Insufficient balance" };
  }

  const cutoff = new Date(Date.now() - MATCH_WINDOW_MS);
  const existing = await myGames(userId);

  // 1. Already in a started game? Resume it (must be a real 2-player game).
  const live = existing.find(
    (g) => g.status === "ACTIVE" && g.players.length >= 2
  );
  if (live) return { status: "matched", gameId: live.id };

  // 2. Tidy up: cancel every stale / duplicate / broken lobby of mine. Keep at
  //    most one fresh WAITING lobby that still matches the requested bucket.
  let myLobby: (typeof existing)[number] | null = null;
  for (const g of existing) {
    const keepable =
      g.status === "WAITING" &&
      g.players.length === 1 &&
      g.gameMode === gameMode &&
      Number(g.entryFee) === entryFee &&
      g.createdAt >= cutoff &&
      !myLobby;
    if (keepable) {
      myLobby = g;
    } else {
      await cancelGame(g.id);
    }
  }

  // 3. Look for an opponent's open lobby in the same bucket.
  const openLobbies = await prisma.game.findMany({
    where: {
      ...MM_SHAPE,
      status: "WAITING",
      gameMode,
      entryFee,
      creatorId: { not: userId },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    include: { players: { select: { userId: true } } },
  });
  const opponent = openLobbies.find(
    (g) =>
      g.players.length === 1 &&
      !AIPlayer.isAIPlayer(g.players[0].userId) &&
      g.players[0].userId !== userId
  );

  // Deterministic tie-break: only the "newer" side joins, so two racing users
  // converge on one lobby instead of swapping.
  const iJoin =
    opponent &&
    (!myLobby ||
      opponent.createdAt.getTime() < myLobby.createdAt.getTime() ||
      (opponent.createdAt.getTime() === myLobby.createdAt.getTime() &&
        opponent.id < myLobby.id));

  if (opponent && iJoin) {
    const joined = await joinLobby(opponent.id, userId).catch(() => false);
    if (joined) {
      if (myLobby) await cancelGame(myLobby.id);
      try {
        await collectEntryFeesAndStartGame(opponent.id);
      } catch (e) {
        // Roll our join back so the lobby can be reused / cleaned.
        await prisma.gamePlayer
          .deleteMany({ where: { gameId: opponent.id, userId } })
          .catch(() => {});
        return {
          status: "error",
          message: e instanceof Error ? e.message : "Could not start game",
        };
      }
      return { status: "matched", gameId: opponent.id };
    }
    // join failed (race) → fall through and (re)create our own lobby
  }

  if (myLobby) return { status: "searching", gameId: myLobby.id };

  // 4. No opponent — open a fresh lobby and wait.
  const game = await prisma.game.create({
    data: {
      roomId: generateRoomId(),
      ...MM_SHAPE,
      gameMode,
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
    if (game.players.some((p) => p.userId === userId)) return true;
    if (game.players.length >= game.maxPlayers) return false;

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

/** Cancel the caller's open matchmaking lobbies (client pressed "stop"). */
export async function cancelMatchmaking(userId: string): Promise<void> {
  const mine = await prisma.game.findMany({
    where: {
      ...MM_SHAPE,
      status: "WAITING",
      creatorId: userId,
    },
    select: { id: true, players: true },
  });
  for (const g of mine) {
    // Only cancel lobbies that never got a 2nd player.
    if (g.players.length <= 1) await cancelGame(g.id);
  }
}

/**
 * Server-side safety net: pair any two waiting lobbies in the same bucket even
 * if neither client is polling. Returns the games it started, as
 * `{ gameId, userIds }` so the socket layer can notify both players.
 */
export async function pairWaitingLobbies(): Promise<
  { gameId: string; userIds: string[] }[]
> {
  const cutoff = new Date(Date.now() - MATCH_WINDOW_MS);
  const waiting = await prisma.game.findMany({
    where: {
      ...MM_SHAPE,
      status: "WAITING",
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    include: { players: { select: { userId: true } } },
  });

  // Bucket by mode + fee; only single-human lobbies are matchable.
  const buckets = new Map<string, typeof waiting>();
  for (const g of waiting) {
    if (g.players.length !== 1) continue;
    if (AIPlayer.isAIPlayer(g.players[0].userId)) continue;
    const key = `${g.gameMode}:${Number(g.entryFee)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(g);
    else buckets.set(key, [g]);
  }

  const started: { gameId: string; userIds: string[] }[] = [];
  for (const lobbies of buckets.values()) {
    for (let i = 0; i + 1 < lobbies.length; i += 2) {
      const host = lobbies[i];
      const guest = lobbies[i + 1];
      const guestUser = guest.players[0].userId;
      if (host.players[0].userId === guestUser) continue;

      const joined = await joinLobby(host.id, guestUser).catch(() => false);
      if (!joined) continue;
      await cancelGame(guest.id);
      try {
        await collectEntryFeesAndStartGame(host.id);
        started.push({
          gameId: host.id,
          userIds: [host.players[0].userId, guestUser],
        });
      } catch {
        // Couldn't collect fees (balance) — undo the join so it can retry.
        await prisma.gamePlayer
          .deleteMany({ where: { gameId: host.id, userId: guestUser } })
          .catch(() => {});
      }
    }
  }
  return started;
}
