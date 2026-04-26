/**
 * Script to make a user an admin
 * Usage: npx tsx scripts/make-admin.ts <email|username>
 *
 * Example:
 * npx tsx scripts/make-admin.ts admin@example.com
 * or
 * npx tsx scripts/make-admin.ts adminuser
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeAdmin(identifier: string) {
  try {
    // Try to find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      console.error(`User not found: ${identifier}`);
      process.exit(1);
    }

    if (user.isAdmin) {
      console.log(`User ${user.username} (${user.email}) is already an admin`);
      process.exit(0);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });

    console.log(
      `✅ Successfully made ${updatedUser.username} (${updatedUser.email}) an admin`
    );
    console.log(`   User ID: ${updatedUser.id}`);
  } catch (error) {
    console.error("Error making user admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const identifier = process.argv[2];

if (!identifier) {
  console.error("Usage: npx tsx scripts/make-admin.ts <email|username>");
  process.exit(1);
}

makeAdmin(identifier);
