/* When one player leaves a paid game, the other wins the pot (not "both lose").
   Server must be running. Run: npx tsx scripts/test-forfeit.ts */
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { io as ioc, type Socket } from "socket.io-client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
let pass = 0,
  fail = 0;
const check = (n: string, c: boolean) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}`);
  c ? pass++ : fail++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bal = async (id: string) =>
  Number(
    (await prisma.user.findUniqueOrThrow({ where: { id } })).walletBalance
  );

function connect(gameId: string, userId: string): Promise<Socket> {
  return new Promise((res) => {
    const s = ioc(BASE, { path: "/api/socket", transports: ["websocket"] });
    s.on("connect", () => {
      s.emit("game:join", { gameId, userId });
      setTimeout(() => res(s), 800);
    });
  });
}

async function main() {
  const a = await prisma.user.findUniqueOrThrow({
    where: { email: "iamsaeedsetayesh@gmail.com" },
  });
  const b = await prisma.user.findUniqueOrThrow({
    where: { email: "p2@ledo.game" },
  });
  await prisma.user.updateMany({
    where: { id: { in: [a.id, b.id] } },
    data: { walletBalance: new Decimal(100) },
  });
  await prisma.game.updateMany({
    where: {
      players: { some: { userId: { in: [a.id, b.id] } } },
      status: { in: ["WAITING", "ACTIVE"] },
    },
    data: { status: "FINISHED", finishedAt: new Date() },
  });

  // A 2-human paid game, already started (fees collected).
  const game = await prisma.game.create({
    data: {
      roomId: "FF" + Date.now(),
      gameType: "SOLO",
      gameMode: "CLASSIC",
      maxPlayers: 2,
      entryFee: new Decimal(10),
      totalPot: new Decimal(20),
      creatorId: a.id,
      status: "ACTIVE",
      startedAt: new Date(),
      players: {
        create: [
          { userId: a.id, position: 0, color: "RED", status: "ACTIVE" },
          { userId: b.id, position: 1, color: "BLUE", status: "ACTIVE" },
        ],
      },
    },
  });
  // Simulate the entry fees already taken at start.
  for (const uid of [a.id, b.id]) {
    await prisma.user.update({
      where: { id: uid },
      data: { walletBalance: { decrement: 10 } },
    });
    await prisma.transaction.create({
      data: {
        userId: uid,
        type: "ENTRY_FEE",
        amount: new Decimal(10),
        status: "COMPLETED",
        gameId: game.id,
      },
    });
  }
  check("both start at 90 after entry fee", (await bal(a.id)) === 90 && (await bal(b.id)) === 90);

  const sA = await connect(game.id, a.id);
  const sB = await connect(game.id, b.id);
  await sleep(500);

  let bFinished: any = null;
  sB.on("game:finished", (info) => (bFinished = info));

  // A leaves the game (explicit).
  sA.emit("game:leave", { gameId: game.id, userId: a.id });
  sA.disconnect();

  // Explicit-leave grace is ~4s; give it a bit more.
  await sleep(9000);

  const g = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
  const aFinal = await bal(a.id);
  const bFinal = await bal(b.id);
  console.log(`  status=${g.status} winner=${g.winnerId === b.id ? "B" : g.winnerId} A=${aFinal} B=${bFinal}`);

  check("game FINISHED", g.status === "FINISHED");
  check("B (who stayed) is the winner", g.winnerId === b.id);
  check("B got the pot minus commission (90 + 16.6 = 106.6)", Math.abs(bFinal - 106.6) < 0.01);
  check("A (who left) stays down 10", aFinal === 90);
  check("B received a game:finished event", !!bFinished && bFinished.winnerUserId === b.id);

  sB.disconnect();
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
