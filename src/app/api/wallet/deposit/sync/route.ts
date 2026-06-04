import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserLedgerBalance } from "@/lib/blockchain/wallet";
import { syncOnChainDeposits } from "@/lib/wallet/sync-deposits";

/** Scan TronGrid for incoming USDT and credit any new deposits. */
export async function POST() {
  try {
    const user = await requireAuth();
    const result = await syncOnChainDeposits(user.id);
    const balance = await getUserLedgerBalance(user.id);

    return NextResponse.json({
      success: true,
      credited: result.credited,
      transactions: result.transactions,
      balance: balance.toString(),
    });
  } catch (error: any) {
    console.error("Deposit sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync deposits" },
      { status: 500 }
    );
  }
}
