/* AFK forfeit: a connected-but-idle player loses a paid game after AFK_LIMIT_MS.
   Start the server with a short limit:  AFK_LIMIT_MS=20000 npm run dev
   then: npx tsx scripts/test-afk.ts */
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

function conn(gameId: string, userId: string): Promise<Socket> {
  return new Promise((res) => {
    const s = ioc(BASE, { path: "/api/socket", transports: ["websocket"] });
    s.on("connect", () => {
      s.emit("game:join", { gameId, userId });
      setTimeout(() => res(s), 700);
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
    data: { walletBalance: new Decimal(90) },
  });
  await prisma.game.updateMany({
    where: {
      players: { some: { userId: { in: [a.id, b.id] } } },
      status: { in: ["WAITING", "ACTIVE"] },
    },
    data: { status: "FINISHED", finishedAt: new Date() },
  });

  const game = await prisma.game.create({
    data: {
      roomId: "AFK" + Date.now(),
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
  for (const uid of [a.id, b.id]) {
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

  // Both connect. B keeps rolling; A never acts (AFK).
  const sA = await conn(game.id, a.id);
  const sB = await conn(game.id, b.id);
  let finish: any = null;
  sB.on("game:finished", (i) => (finish = i));

  const rollLoop = setInterval(() => {
    sB.emit("game:roll-dice", { gameId: game.id, userId: b.id });
  }, 3000);

  const limit = Number(process.env.AFK_LIMIT_MS) || 20000;
  console.log(`  waiting ~${(limit + 25000) / 1000}s for AFK forfeit…`);
  await sleep(limit + 25000);
  clearInterval(rollLoop);

  const g = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
  const aFinal = await bal(a.id);
  const bFinal = await bal(b.id);
  console.log(`  status=${g.status} winner=${g.winnerId === b.id ? "B" : g.winnerId} A=${aFinal} B=${bFinal}`);
  check("game FINISHED (AFK forced it to end)", g.status === "FINISHED");
  check("B (active) is the winner", g.winnerId === b.id);
  const commissionRate = (parseFloat(process.env.COMMISSION_RATE || "15") || 15) / 100;
  const expectedB = 90 + 20 * (1 - commissionRate);
  check(
    `B got pot minus commission (${expectedB.toFixed(2)})`,
    Math.abs(bFinal - expectedB) < 0.01
  );
  check("A (idle) stays down 10", aFinal === 90);
  check("game:finished emitted for B", !!finish && finish.winnerUserId === b.id);

  sA.disconnect();
  sB.disconnect();
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
