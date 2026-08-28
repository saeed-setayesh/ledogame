/* Create an ACTIVE test game (default RUSH) for manual QA.
   Usage: npx tsx scripts/mk-test-game.ts [RUSH|CLASSIC] */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mode = (process.argv[2] || "RUSH") as "RUSH" | "CLASSIC";
  const me = await prisma.user.findUniqueOrThrow({
    where: { email: "iamsaeedsetayesh@gmail.com" },
  });
  const ais: string[] = [];
  for (let i = 0; i < 2; i++) {
    const id = `AI_${i}`;
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: `ai_${i}@ledo.game`,
        username: `Bot ${i}`,
        password: "x",
        walletBalance: 1000,
      },
    });
    ais.push(id);
  }
  const g = await prisma.game.create({
    data: {
      roomId: mode + Date.now(),
      gameType: "SOLO",
      gameMode: mode,
      maxPlayers: 3,
      entryFee: 0,
      creatorId: me.id,
      status: "ACTIVE",
      startedAt: new Date(),
      players: {
        create: [
          { userId: me.id, position: 0, color: "RED", status: "ACTIVE" },
          { userId: ais[0], position: 1, color: "BLUE", status: "ACTIVE" },
          { userId: ais[1], position: 2, color: "GREEN", status: "ACTIVE" },
        ],
      },
    },
  });
  console.log("GAME_URL http://localhost:3000/game/" + g.id);
}
main().finally(() => prisma.$disconnect());
