import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getLudinoOnChainUsdtBalance,
  getUserLedgerBalance,
} from "@/lib/blockchain/wallet";
import { getDepositInstructions } from "@/lib/blockchain/bsc";
import { getBscNetworkLabel, getBscScanBaseUrl } from "@/lib/blockchain/bsc-network";
import { getLudinoWalletInfo } from "@/lib/wallet/ludino-wallet";
import { syncOnChainDeposits } from "@/lib/wallet/sync-deposits";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const autoSync = searchParams.get("sync") === "true";

    const ludino = getLudinoWalletInfo();

    if (autoSync) {
      try {
        await syncOnChainDeposits(user.id);
      } catch (e) {
        console.warn("Deposit auto-sync skipped:", e);
      }
    }

    const [balance, onChainUsdt] = await Promise.all([
      getUserLedgerBalance(user.id),
      getLudinoOnChainUsdtBalance(),
    ]);

    const instructions = getDepositInstructions();

    return NextResponse.json({
      balance: balance.toString(),
      address: ludino.address,
      network: ludino.network,
      networkLabel: getBscNetworkLabel(),
      explorerUrl: `${getBscScanBaseUrl()}/address/${ludino.address}`,
      onChainUsdt: onChainUsdt.toString(),
      isMock: false,
      usdtContract: instructions.usdtContract,
      isTestnet: instructions.isTestnet,
      withdrawalsEnabled: ludino.hasPrivateKey,
    });
  } catch (error: any) {
    console.error("Balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get balance" },
      { status: 500 }
    );
  }
}
