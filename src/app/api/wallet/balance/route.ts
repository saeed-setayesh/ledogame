import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { syncWalletBalance } from "@/lib/blockchain/wallet";
import { prisma } from "@/lib/prisma";
import { generateMockAddress } from "@/lib/wallet/mock-wallet";

export async function GET() {
  try {
    const user = await requireAuth();

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true, walletAddress: true },
    });

    // If no real wallet exists, generate and store a mock address
    if (!dbUser?.walletAddress) {
      const mockAddress = generateMockAddress();

      // Store the mock address in the database for consistency
      await prisma.user.update({
        where: { id: user.id },
        data: { walletAddress: mockAddress },
      });

      // Use database balance or default to 100 for new users
      const balance = dbUser?.walletBalance?.toString() || "100.00";

      return NextResponse.json({
        balance,
        address: mockAddress,
        isMock: true,
      });
    }

    // Sync balance from blockchain (only if real wallet exists)
    try {
      await syncWalletBalance(user.id);
    } catch (error) {
      // If blockchain sync fails, return database balance
      console.warn("Blockchain sync failed, using database balance:", error);
    }

    // Get updated balance from database
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true, walletAddress: true },
    });

    return NextResponse.json({
      balance: updatedUser?.walletBalance.toString() || "0",
      address: updatedUser?.walletAddress || null,
      isMock: false,
    });
  } catch (error: any) {
    console.error("Balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get balance" },
      { status: 500 }
    );
  }
}
