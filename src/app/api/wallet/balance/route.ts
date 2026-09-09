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

    // The play balance must always load, even if deposit config is missing.
    const balance = await getUserLedgerBalance(user.id);

    // Everything below depends on the Ludino BEP20 wallet being configured.
    // Degrade gracefully so the wallet page still shows the balance + withdraw.
    let deposit: {
      address: string | null;
      network: string | null;
      networkLabel: string | null;
      explorerUrl: string | null;
      onChainUsdt: string;
      usdtContract: string | null;
      isTestnet: boolean;
      withdrawalsEnabled: boolean;
      configured: boolean;
    } = {
      address: null,
      network: null,
      networkLabel: null,
      explorerUrl: null,
      onChainUsdt: "0",
      usdtContract: null,
      isTestnet: false,
      withdrawalsEnabled: false,
      configured: false,
    };

    try {
      const ludino = getLudinoWalletInfo();

      if (autoSync) {
        try {
          await syncOnChainDeposits(user.id);
        } catch (e) {
          console.warn("Deposit auto-sync skipped:", e);
        }
      }

      const onChainUsdt = await getLudinoOnChainUsdtBalance().catch((e) => {
        console.warn("On-chain USDT balance lookup failed:", e);
        return 0;
      });
      const instructions = getDepositInstructions();

      deposit = {
        address: ludino.address,
        network: ludino.network,
        networkLabel: getBscNetworkLabel(),
        explorerUrl: `${getBscScanBaseUrl()}/address/${ludino.address}`,
        onChainUsdt: onChainUsdt.toString(),
        usdtContract: instructions.usdtContract,
        isTestnet: instructions.isTestnet,
        withdrawalsEnabled: ludino.hasPrivateKey,
        configured: true,
      };
    } catch (e) {
      console.warn("Deposit config unavailable:", e);
    }

    return NextResponse.json({
      balance: balance.toString(),
      isMock: false,
      ...deposit,
    });
  } catch (error: any) {
    console.error("Balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get balance" },
      { status: 500 }
    );
  }
}
