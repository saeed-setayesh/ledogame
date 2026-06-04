import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { refundGameEntryFees } from "@/lib/wallet/game-payments";

/** Admin cancels a game and refunds entry fees if they were collected. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { gameId, reason } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status === "CANCELLED" || game.status === "FINISHED") {
      return NextResponse.json(
        { error: "Game is already finished or cancelled" },
        { status: 400 }
      );
    }

    const feeCount = await prisma.transaction.count({
      where: { gameId, type: "ENTRY_FEE", status: "COMPLETED" },
    });

    let refundedTotal = 0;
    if (feeCount > 0) {
      refundedTotal = await refundGameEntryFees(
        gameId,
        reason || "Game cancelled by admin"
      );
    } else {
      await prisma.game.update({
        where: { id: gameId },
        data: { status: "CANCELLED", finishedAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      refundedTotal: refundedTotal.toString(),
    });
  } catch (error: any) {
    console.error("Admin cancel game error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel game" },
      { status: 500 }
    );
  }
}
