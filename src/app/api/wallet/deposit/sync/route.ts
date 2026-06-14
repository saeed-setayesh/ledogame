import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserLedgerBalance } from "@/lib/blockchain/wallet";
import { syncOnChainDeposits } from "@/lib/wallet/sync-deposits";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const fromAddress =
      typeof body.fromAddress === "string" ? body.fromAddress : undefined;

    const result = await syncOnChainDeposits(user.id, fromAddress);
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
