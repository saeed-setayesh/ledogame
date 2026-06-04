import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getOnChainUsdtBalance,
  getUserLedgerBalance,
} from "@/lib/blockchain/wallet";
import { ensureUserDepositWallet } from "@/lib/wallet/deposit-wallet";
import { getDepositInstructions } from "@/lib/blockchain/tron-deposits";
import { getTronNetworkLabel } from "@/lib/blockchain/tron-network";
import { syncOnChainDeposits } from "@/lib/wallet/sync-deposits";
import { useRealTronDeposits } from "@/lib/wallet/config";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const autoSync = searchParams.get("sync") === "true";

    if (!useRealTronDeposits()) {
      return NextResponse.json(
        { error: "Real Tron wallets are disabled (USE_REAL_TRON_WALLETS=false)" },
        { status: 503 }
      );
    }

    const wallet = await ensureUserDepositWallet(user.id);

    if (autoSync) {
      await syncOnChainDeposits(user.id);
    }

    const [balance, onChainUsdt] = await Promise.all([
      getUserLedgerBalance(user.id),
      getOnChainUsdtBalance(user.id),
    ]);

    const instructions = getDepositInstructions();

    return NextResponse.json({
      balance: balance.toString(),
      address: wallet.address,
      network: wallet.network,
      networkLabel: getTronNetworkLabel(),
      onChainUsdt: onChainUsdt.toString(),
      isMock: false,
      migratedFromMock: wallet.migratedFromMock,
      usdtContract: instructions.usdtContract,
      isTestnet: instructions.isTestnet,
    });
  } catch (error: any) {
    console.error("Balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get balance" },
      { status: 500 }
    );
  }
}
