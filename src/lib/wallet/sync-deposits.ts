import { prisma } from "@/lib/prisma";
import { processDeposit } from "@/lib/blockchain/wallet";
import { fetchIncomingUsdtTransfers } from "@/lib/blockchain/bsc-deposits";
import { getLudinoUsdtAddress } from "@/lib/wallet/ludino-wallet";

/**
 * Scan BscScan for USDT sent to Ludino wallet.
 * Optional fromAddress filters to the user's external wallet (stored after first deposit).
 */
export async function syncOnChainDeposits(
  userId: string,
  fromAddress?: string
): Promise<{
  credited: number;
  transactions: Array<{ txHash: string; amount: number }>;
}> {
  const ludino = getLudinoUsdtAddress();

  let sender = fromAddress?.trim();
  if (!sender) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });
    if (user?.walletAddress?.startsWith("0x")) {
      sender = user.walletAddress;
    }
  }

  const incoming = await fetchIncomingUsdtTransfers(ludino, sender, 50);
  const credited: Array<{ txHash: string; amount: number }> = [];
  let total = 0;

  for (const transfer of incoming) {
    const existing = await prisma.transaction.findFirst({
      where: {
        txHash: transfer.transactionId,
        type: "DEPOSIT",
        status: "COMPLETED",
      },
    });
    if (existing) continue;

    try {
      await processDeposit(
        userId,
        transfer.transactionId,
        transfer.amount
      );
      credited.push({
        txHash: transfer.transactionId,
        amount: transfer.amount,
      });
      total += transfer.amount;
    } catch (err: any) {
      if (!err.message?.includes("already processed")) {
        console.error(
          `[sync-deposits] ${transfer.transactionId}:`,
          err.message
        );
      }
    }
  }

  return { credited: total, transactions: credited };
}
