/**
 * Seed local test database with a few players that have wallet balances.
 * Usage: npx tsx scripts/seed-test.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("1378", 10);
  const users = [
    { email: "iamsaeedsetayesh@gmail.com", username: "saeed", countryCode: "IR" },
    { email: "p2@ledo.game", username: "player2", countryCode: "US" },
    { email: "p3@ledo.game", username: "player3", countryCode: "GB" },
    { email: "p4@ledo.game", username: "player4", countryCode: "DE" },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { walletBalance: 100 },
      create: {
        email: u.email,
        username: u.username,
        password,
        countryCode: u.countryCode,
        walletBalance: 100,
        isAdmin: u.username === "saeed",
      },
    });
    console.log(`user ${user.username} (${user.id}) balance=${user.walletBalance}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
