import { prisma } from "@/lib/prisma";
import { generateRoomId } from "@/lib/utils";
import { AIPlayer } from "@/lib/game/ai-player";
import { collectEntryFeesAndStartGame } from "@/lib/wallet/game-payments";

/** Quick Match games carry this roomId prefix so they can never be confused
 *  with practice (has AI) or friend-challenge games. */
const QM_PREFIX = "QM-";
/** Lobbies older than this are treated as stale and cleaned up. */
const MATCH_WINDOW_MS = 3 * 60 * 1000;
/** A partly-filled lobby (≥2 real players) starts anyway after this, so a
 *  3-4 player match doesn't wait forever for the last seat. */
const AUTOSTART_AFTER_MS = 25 * 1000;

const COLORS = ["RED", "BLUE", "GREEN", "YELLOW"] as const;

export type MatchmakeResult =
  | { status: "matched"; gameId: string }
  | { status: "searching"; gameId: string; players: number; needed: number }
  | { status: "error"; message: string };

type LobbyRow = {
  id: string;
  roomId: string;
  createdAt: Date;
  status: string;
  gameMode: string;
  entryFee: unknown;
  maxPlayers: number;
  creatorId: string;
  players: { userId: string }[];
};

function clampPlayers(n: unknown): 2 | 3 | 4 {
  const v = Math.round(Number(n) || 2);
  return v <= 2 ? 2 : v >= 4 ? 4 : 3;
}

function allHuman(g: { players: { userId: string }[] }) {
  return g.players.every((p) => !AIPlayer.isAIPlayer(p.userId));
}

/** Every WAITING/ACTIVE Quick-Match game this user is a player in, newest first. */
async function myQuickMatchGames(userId: string): Promise<LobbyRow[]> {
  const games = await prisma.game.findMany({
    where: {
      roomId: { startsWith: QM_PREFIX },
      gameType: "SOLO",
      status: { in: ["WAITING", "ACTIVE"] },
      players: { some: { userId } },
    },
    orderBy: { createdAt: "desc" },
    include: { players: { select: { userId: true } } },
  });
  return games.filter(allHuman) as LobbyRow[];
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
 * Ensure the user is sitting in exactly one Quick-Match lobby of the requested
 * bucket, or resume a live game. The server-side pairer (`pairWaitingLobbies`)
 * does all the actual pairing + starting; the client also polls this.
 */
export async function matchmake(
  userId: string,
  entryFee: number,
  gameMode: "CLASSIC" | "RUSH",
  maxPlayers: 2 | 3 | 4 = 2
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
  const existing = await myQuickMatchGames(userId);

  // 1. Already in a started (real, human) game? Resume it.
  const live = existing.find(
    (g) => g.status === "ACTIVE" && g.players.length >= 2
  );
  if (live) return { status: "matched", gameId: live.id };

  // 2. Merged into a lobby that's filling up? Wait on it (don't cancel it).
  const filling = existing.find(
    (g) => g.status === "WAITING" && g.players.length >= 2
  );
  if (filling) {
    return {
      status: "searching",
      gameId: filling.id,
      players: filling.players.length,
      needed: filling.maxPlayers,
    };
  }

  // 3. Keep at most one fresh solo lobby matching this exact bucket; cancel the rest.
  let myLobby: LobbyRow | null = null;
  for (const g of existing) {
    const keepable =
      !myLobby &&
      g.status === "WAITING" &&
      g.players.length === 1 &&
      g.creatorId === userId &&
      g.gameMode === gameMode &&
      Number(g.entryFee) === entryFee &&
      g.maxPlayers === maxPlayers &&
      g.createdAt >= cutoff;
    if (keepable) myLobby = g;
    else await cancelGame(g.id);
  }

  if (!myLobby) {
    const game = await prisma.game.create({
      data: {
        roomId: QM_PREFIX + generateRoomId(),
        gameType: "SOLO",
        gameMode,
        maxPlayers,
        entryFee,
        creatorId: userId,
        status: "WAITING",
        players: {
          create: { userId, position: 0, color: "RED", status: "ACTIVE" },
        },
      },
      include: { players: { select: { userId: true } } },
    });
    myLobby = game as LobbyRow;
  }

  return {
    status: "searching",
    gameId: myLobby.id,
    players: myLobby.players.length,
    needed: maxPlayers,
  };
}

/** Cancel the caller's open Quick-Match lobbies (client pressed "stop"). */
export async function cancelMatchmaking(userId: string): Promise<void> {
  const mine = await prisma.game.findMany({
    where: {
      roomId: { startsWith: QM_PREFIX },
      status: "WAITING",
      creatorId: userId,
    },
    select: { id: true, players: true },
  });
  for (const g of mine) {
    if (g.players.length <= 1) await cancelGame(g.id);
  }
}

/** Add a player to a still-open lobby, coloured by seat. */
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
        color: COLORS[game.players.length % 4],
        status: "ACTIVE",
      },
    });
    return true;
  });
}

/**
 * Server-side pairer (runs on an interval). For every bucket
 * (mode + fee + player-count) it merges waiting solo lobbies into groups and
 * starts them — full groups immediately, partial groups (≥2 real players) once
 * the oldest lobby has waited AUTOSTART_AFTER_MS. Returns the games it started.
 */
export async function pairWaitingLobbies(): Promise<
  { gameId: string; userIds: string[] }[]
> {
  const cutoff = new Date(Date.now() - MATCH_WINDOW_MS);
  const waiting = (await prisma.game.findMany({
    where: {
      roomId: { startsWith: QM_PREFIX },
      gameType: "SOLO",
      status: "WAITING",
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    include: { players: { select: { userId: true } } },
  })) as LobbyRow[];

  // Only solo, all-human lobbies participate.
  const solo = waiting.filter(
    (g) => g.players.length === 1 && allHuman(g)
  );

  const buckets = new Map<string, LobbyRow[]>();
  for (const g of solo) {
    const key = `${g.gameMode}:${Number(g.entryFee)}:${g.maxPlayers}`;
    const arr = buckets.get(key);
    if (arr) arr.push(g);
    else buckets.set(key, [g]);
  }

  const started: { gameId: string; userIds: string[] }[] = [];

  for (const lobbies of buckets.values()) {
    const need = lobbies[0].maxPlayers;
    for (let i = 0; i < lobbies.length; i += need) {
      const group = lobbies.slice(i, i + need);
      const full = group.length === need;
      const oldEnough =
        group.length >= 2 &&
        Date.now() - group[0].createdAt.getTime() >= AUTOSTART_AFTER_MS;
      if (!full && !oldEnough) continue;

      const host = group[0];
      const guests = group.slice(1);
      const joinedUsers: string[] = [host.players[0].userId];
      for (const guest of guests) {
        const uid = guest.players[0].userId;
        if (joinedUsers.includes(uid)) continue;
        if (await joinLobby(host.id, uid).catch(() => false)) {
          await cancelGame(guest.id);
          joinedUsers.push(uid);
        }
      }
      if (joinedUsers.length < 2) continue;

      try {
        await collectEntryFeesAndStartGame(host.id);
        started.push({ gameId: host.id, userIds: joinedUsers });
      } catch {
        // fee collection failed (balance) — undo the joins so it can retry
        for (const uid of joinedUsers.slice(1)) {
          await prisma.gamePlayer
            .deleteMany({ where: { gameId: host.id, userId: uid } })
            .catch(() => {});
        }
      }
    }
  }
  return started;
}
