import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AIPlayer } from "@/lib/game/ai-player";
import {
  deductEntryFeeInTx,
  entryFeeAlreadyCharged,
  getCommissionRateFraction,
  processCommission,
  processPayout,
  refundEntryFeeInTx,
} from "@/lib/blockchain/wallet";

export async function countHumanPlayers(gameId: string): Promise<number> {
  const players = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: { userId: true },
  });
  return players.filter((p) => !AIPlayer.isAIPlayer(p.userId)).length;
}

/**
 * Collect entry fees from all human players and mark the game ACTIVE.
 * Idempotent: skips humans already charged for this game.
 */
export async function collectEntryFeesAndStartGame(gameId: string): Promise<{
  started: boolean;
  totalPot: number;
}> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.status === "CANCELLED" || game.status === "FINISHED") {
    throw new Error("Game cannot be started");
  }

  const entryFee = parseFloat(game.entryFee.toString());

  if (entryFee <= 0) {
    if (game.status !== "ACTIVE") {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "ACTIVE",
          startedAt: game.startedAt ?? new Date(),
          totalPot: new Decimal(0),
        },
      });
    }
    return { started: true, totalPot: 0 };
  }

  const humans = game.players.filter((p) => !AIPlayer.isAIPlayer(p.userId));
  if (humans.length < 2) {
    throw new Error("At least 2 human players are required to start a paid game");
  }

  const alreadyActiveWithFees =
    game.status === "ACTIVE" &&
    (await prisma.transaction.count({
      where: { gameId, type: "ENTRY_FEE", status: "COMPLETED" },
    })) > 0;

  if (alreadyActiveWithFees) {
    return {
      started: true,
      totalPot: parseFloat(game.totalPot.toString()),
    };
  }

  if (game.status === "ACTIVE") {
    throw new Error("Game is already active without entry fees recorded");
  }

  const totalPot = await prisma.$transaction(async (tx) => {
    const fresh = await tx.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });
    if (!fresh || fresh.status !== "WAITING") {
      throw new Error("Game is not in waiting state");
    }

    const humanPlayers = fresh.players.filter(
      (p) => !AIPlayer.isAIPlayer(p.userId)
    );

    for (const player of humanPlayers) {
      const charged = await entryFeeAlreadyCharged(tx, player.userId, gameId);
      if (charged) continue;

      const user = await tx.user.findUnique({
        where: { id: player.userId },
        select: { walletBalance: true },
      });
      if (!user) throw new Error("User not found");
      const balance = parseFloat(user.walletBalance.toString());
      if (balance < entryFee) {
        throw new Error("Insufficient balance for one or more players");
      }
    }

    for (const player of humanPlayers) {
      await deductEntryFeeInTx(tx, player.userId, entryFee, gameId);
    }

    const pot = entryFee * humanPlayers.length;
    await tx.game.update({
      where: { id: gameId },
      data: {
        status: "ACTIVE",
        startedAt: new Date(),
        totalPot: new Decimal(pot),
      },
    });
    return pot;
  });

  return { started: true, totalPot };
}

/** Refund all completed entry fees for a game (e.g. cancel). Idempotent per player. */
export async function refundGameEntryFees(
  gameId: string,
  reason: string
): Promise<number> {
  const entryFees = await prisma.transaction.findMany({
    where: {
      gameId,
      type: "ENTRY_FEE",
      status: "COMPLETED",
    },
  });

  let refunded = 0;

  await prisma.$transaction(async (tx) => {
    for (const fee of entryFees) {
      const amount = parseFloat(fee.amount.toString());
      const done = await refundEntryFeeInTx(
        tx,
        fee.userId,
        amount,
        gameId,
        reason
      );
      if (done) refunded += amount;
    }

    await tx.game.update({
      where: { id: gameId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
  });

  return refunded;
}

export async function tryAutoStartPaidGame(gameId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "WAITING") return false;

  const entryFee = parseFloat(game.entryFee.toString());
  if (entryFee <= 0) return false;

  const playerCount = game.players.length;
  if (playerCount < game.maxPlayers) return false;

  try {
    await collectEntryFeesAndStartGame(gameId);
    return true;
  } catch (e) {
    console.error(`[Game ${gameId}] Auto-start failed:`, e);
    return false;
  }
}

export async function settleGameWinner(
  gameId: string,
  winnerUserId: string
): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status === "FINISHED") return;

  const totalPot = parseFloat(game.totalPot.toString());
  const rate = getCommissionRateFraction();
  const commission = totalPot * rate;
  const payout = totalPot - commission;

  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: "FINISHED",
      finishedAt: new Date(),
      winnerId: winnerUserId,
      commissionAmount: new Decimal(commission),
    },
  });

  await prisma.gamePlayer.updateMany({
    where: { gameId, userId: winnerUserId },
    data: {
      isWinner: true,
      payoutAmount: new Decimal(payout),
      status: "FINISHED",
    },
  });

  if (payout > 0) {
    await processPayout(winnerUserId, payout, gameId);
  }
  if (commission > 0) {
    await processCommission(commission, gameId);
  }

  const winner = await prisma.user.findUnique({
    where: { id: winnerUserId },
  });

  if (winner) {
    const newXP = winner.xp + 100;
    const newLevel = Math.floor(newXP / 1000) + 1;
    await prisma.user.update({
      where: { id: winnerUserId },
      data: {
        xp: newXP,
        level: newLevel,
        totalWins: winner.totalWins + 1,
        totalGames: winner.totalGames + 1,
      },
    });
  }

  await prisma.user.updateMany({
    where: {
      id: {
        in: game.players
          .filter((p) => p.userId !== winnerUserId)
          .map((p) => p.userId),
      },
    },
    data: { totalGames: { increment: 1 } },
  });
}
