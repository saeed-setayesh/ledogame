/* Create an ACTIVE 2-human game (saeed + player2) for manual QA.
   Usage: npx tsx scripts/mk-2p-game.ts [RUSH|CLASSIC] */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mode = (process.argv[2] || "CLASSIC") as "RUSH" | "CLASSIC";
  const a = await prisma.user.findUniqueOrThrow({
    where: { email: "iamsaeedsetayesh@gmail.com" },
  });
  const b = await prisma.user.findUniqueOrThrow({
    where: { email: "p2@ledo.game" },
  });
  const g = await prisma.game.create({
    data: {
      roomId: mode + "2P" + Date.now(),
      gameType: "SOLO",
      gameMode: mode,
      maxPlayers: 2,
      entryFee: 0,
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
  console.log("GAME_URL http://localhost:3000/game/" + g.id);
}
main().finally(() => prisma.$disconnect());
