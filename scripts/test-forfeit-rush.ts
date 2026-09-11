/* RUSH forfeit (mirrors test-forfeit.ts) + a reconnect-noise regression:
   the REMAINING player's own socket reconnecting mid-grace must not cancel a
   pending forfeit for the player who actually left.
   Server must be running. Run: npx tsx scripts/test-forfeit-rush.ts */
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

async function freshGame(
  a: { id: string },
  b: { id: string },
  mode: "CLASSIC" | "RUSH"
) {
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
  const game = await prisma.game.create({
    data: {
      roomId: "FF" + mode + Date.now(),
      gameType: "SOLO",
      gameMode: mode,
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
  return game;
}

async function main() {
  const a = await prisma.user.findUniqueOrThrow({
    where: { email: "iamsaeedsetayesh@gmail.com" },
  });
  const b = await prisma.user.findUniqueOrThrow({
    where: { email: "p2@ledo.game" },
  });

  console.log("RUSH: leaver forfeits, the one who stayed wins the pot");
  {
    const game = await freshGame(a, b, "RUSH");
    const sA = await connect(game.id, a.id);
    const sB = await connect(game.id, b.id);
    await sleep(500);
    let bFinished: any = null;
    sB.on("game:finished", (info) => (bFinished = info));

    sA.emit("game:leave", { gameId: game.id, userId: a.id });
    sA.disconnect();
    await sleep(9000);

    const g = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    const aFinal = await bal(a.id);
    const bFinal = await bal(b.id);
    console.log(
      `  status=${g.status} winner=${g.winnerId === b.id ? "B" : g.winnerId} A=${aFinal} B=${bFinal}`
    );
    const rate = (parseFloat(process.env.COMMISSION_RATE || "15") || 15) / 100;
    const expected = 90 + 20 * (1 - rate);
    check("game FINISHED", g.status === "FINISHED");
    check("B (who stayed) is the winner", g.winnerId === b.id);
    check(
      `B got the pot minus commission (${expected.toFixed(2)})`,
      Math.abs(bFinal - expected) < 0.01
    );
    check("A (who left) stays down 10", aFinal === 90);
    check("B received a game:finished event", !!bFinished && bFinished.winnerUserId === b.id);

    sB.disconnect();
  }

  console.log(
    "\nCLASSIC: a reconnect from the player who STAYED must not cancel A's forfeit"
  );
  {
    const game = await freshGame(a, b, "CLASSIC");
    const sA = await connect(game.id, a.id);
    let sB = await connect(game.id, b.id);
    await sleep(500);
    let bFinished: any = null;
    const armFinishListener = () =>
      sB.on("game:finished", (info) => (bFinished = info));
    armFinishListener();

    // A leaves for real.
    sA.emit("game:leave", { gameId: game.id, userId: a.id });
    sA.disconnect();

    // Mid-grace, B's OWN socket bounces (e.g. app backgrounded briefly) and
    // rejoins — this must NOT reset/cancel the pending forfeit against A.
    await sleep(2000);
    sB.disconnect();
    await sleep(300);
    sB = await connect(game.id, b.id);
    armFinishListener();

    await sleep(9000);

    const g = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    const aFinal = await bal(a.id);
    const bFinal = await bal(b.id);
    console.log(
      `  status=${g.status} winner=${g.winnerId === b.id ? "B" : g.winnerId} A=${aFinal} B=${bFinal}`
    );
    check("game still resolves to FINISHED despite B's reconnect noise", g.status === "FINISHED");
    check("B is still declared the winner", g.winnerId === b.id);
    check("B got paid (balance grew past 90)", bFinal > 90.001);
    check("A stays down 10 (no refund)", aFinal === 90);

    sB.disconnect();
  }

  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
