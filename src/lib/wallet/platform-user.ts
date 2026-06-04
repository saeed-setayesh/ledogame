import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const PLATFORM_LEDGER_USER_ID = "platform-ledger";

/** House account for commission credits and reporting. */
export async function getPlatformLedgerUserId(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: PLATFORM_LEDGER_USER_ID },
    select: { id: true },
  });
  if (existing) return existing.id;

  await prisma.user.create({
    data: {
      id: PLATFORM_LEDGER_USER_ID,
      email: "platform@ludino.net",
      username: "platform",
      password: "not-used",
      walletBalance: new Decimal(0),
      isAdmin: true,
    },
  });
  return PLATFORM_LEDGER_USER_ID;
}
