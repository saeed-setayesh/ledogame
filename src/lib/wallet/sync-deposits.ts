import { prisma } from "@/lib/prisma";
import { processDeposit } from "@/lib/blockchain/wallet";
import { fetchIncomingUsdtTransfers } from "@/lib/blockchain/tron-deposits";
import { ensureUserDepositWallet } from "@/lib/wallet/deposit-wallet";

export async function syncOnChainDeposits(userId: string): Promise<{
  credited: number;
  transactions: Array<{ txHash: string; amount: number }>;
}> {
  const { address } = await ensureUserDepositWallet(userId);

  const incoming = await fetchIncomingUsdtTransfers(address, 50);
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
      await processDeposit(userId, transfer.transactionId, transfer.amount);
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
