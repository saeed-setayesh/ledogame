/* End-to-end money path: entry fees debited, winner paid, loser stays debited.
   Run: npx tsx scripts/test-settlement.ts */
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  collectEntryFeesAndStartGame,
  settleGameWinner,
} from "../src/lib/wallet/game-payments";

const prisma = new PrismaClient();

async function main() {
  const a = await prisma.user.findUniqueOrThrow({ where: { email: "iamsaeedsetayesh@gmail.com" } });
  const b = await prisma.user.findUniqueOrThrow({ where: { email: "p2@ledo.game" } });
  await prisma.user.update({ where: { id: a.id }, data: { walletBalance: new Decimal(100) } });
  await prisma.user.update({ where: { id: b.id }, data: { walletBalance: new Decimal(100) } });

  const game = await prisma.game.create({
    data: {
      roomId: "TEST" + Date.now(),
      gameType: "SOLO",
      gameMode: "CLASSIC",
      maxPlayers: 2,
      entryFee: new Decimal(10),
      creatorId: a.id,
      status: "WAITING",
      players: {
        create: [
          { userId: a.id, position: 0, color: "RED", status: "ACTIVE" },
          { userId: b.id, position: 1, color: "BLUE", status: "ACTIVE" },
        ],
      },
    },
  });

  await collectEntryFeesAndStartGame(game.id);

  const aAfterFee = await bal(a.id);
  const bAfterFee = await bal(b.id);
  console.log(`after entry fees: A=${aAfterFee} B=${bAfterFee}`);
  assert(aAfterFee === 90, "A debited 10");
  assert(bAfterFee === 90, "B debited 10");

  await settleGameWinner(game.id, a.id);

  const aFinal = await bal(a.id);
  const bFinal = await bal(b.id);
  const g = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
  console.log(`after settle: A=${aFinal} B=${bFinal} status=${g.status} commission=${g.commissionAmount}`);
  // pot 20, commission 17% = 3.4, payout 16.6 => A: 90 + 16.6 = 106.6
  assert(g.status === "FINISHED", "game FINISHED");
  assert(Math.abs(aFinal - 106.6) < 0.001, "winner A paid 16.6 (pot - 17% commission)");
  assert(bFinal === 90, "loser B stays debited 10 (no refund)");

  await prisma.gameMove.deleteMany({ where: { gameId: game.id } });
  await prisma.transaction.deleteMany({ where: { gameId: game.id } });
  await prisma.gamePlayer.deleteMany({ where: { gameId: game.id } });
  await prisma.game.delete({ where: { id: game.id } });
  console.log("\nALL SETTLEMENT CHECKS PASSED");
}

async function bal(id: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return parseFloat(u.walletBalance.toString());
}
function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
