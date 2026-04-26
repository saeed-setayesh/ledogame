import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { processDeposit } from "@/lib/blockchain/wallet";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { txHash, amount, isMock } = await request.json();

    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // If it's a mock deposit, process it directly in the database
    if (isMock) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletBalance: true },
      });

      const currentBalance = parseFloat(
        dbUser?.walletBalance.toString() || "0"
      );
      const newBalance = currentBalance + amountNum;

      await prisma.$transaction(async (tx) => {
        // Update balance
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: new Decimal(newBalance) },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "DEPOSIT",
            amount: new Decimal(amountNum),
            status: "COMPLETED",
            txHash: txHash || `mock_${Date.now()}`,
            description: "Mock deposit",
          },
        });
      });

      return NextResponse.json({
        success: true,
        newBalance: newBalance.toString(),
      });
    }

    // Real blockchain deposit
    if (!txHash) {
      return NextResponse.json(
        { error: "Transaction hash is required for real deposits" },
        { status: 400 }
      );
    }

    await processDeposit(user.id, txHash, amountNum);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Deposit error:", error);
    return NextResponse.json(
      { error: error.message || "Deposit failed" },
      { status: 500 }
    );
  }
}
