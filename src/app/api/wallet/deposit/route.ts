import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { confirmDepositByTxHash } from "@/lib/blockchain/wallet";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { allowMockDeposits } from "@/lib/wallet/config";
import { ensureUserDepositWallet } from "@/lib/wallet/deposit-wallet";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { txHash, amount, isMock } = await request.json();

    if (isMock) {
      if (!allowMockDeposits()) {
        return NextResponse.json(
          { error: "Mock deposits are disabled. Send real USDT to your Tron deposit address." },
          { status: 403 }
        );
      }

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

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletBalance: true },
      });

      const currentBalance = parseFloat(
        dbUser?.walletBalance.toString() || "0"
      );
      const newBalance = currentBalance + amountNum;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: new Decimal(newBalance) },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "DEPOSIT",
            amount: new Decimal(amountNum),
            status: "COMPLETED",
            txHash: txHash || `mock_${Date.now()}`,
            description: "Mock deposit (ALLOW_MOCK_DEPOSITS=true)",
          },
        });
      });

      return NextResponse.json({
        success: true,
        newBalance: newBalance.toString(),
      });
    }

    if (!txHash) {
      return NextResponse.json(
        { error: "Transaction id (txHash) is required" },
        { status: 400 }
      );
    }

    await ensureUserDepositWallet(user.id);

    const expectedAmount =
      amount !== undefined && amount !== null
        ? parseFloat(amount)
        : undefined;

    if (
      expectedAmount !== undefined &&
      (isNaN(expectedAmount) || expectedAmount <= 0)
    ) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const result = await confirmDepositByTxHash(
      user.id,
      txHash,
      expectedAmount
    );

    const newBalance = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    });

    return NextResponse.json({
      success: true,
      amount: result.amount,
      txHash: result.txHash,
      newBalance: newBalance?.walletBalance.toString() || "0",
    });
  } catch (error: any) {
    console.error("Deposit error:", error);
    return NextResponse.json(
      { error: error.message || "Deposit failed" },
      { status: 500 }
    );
  }
}
