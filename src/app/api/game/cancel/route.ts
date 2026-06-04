import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
/** Creator cancels a WAITING lobby (no fees collected yet). */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.creatorId !== user.id) {
      return NextResponse.json(
        { error: "Only the creator can cancel this game" },
        { status: 403 }
      );
    }

    if (game.status !== "WAITING") {
      return NextResponse.json(
        { error: "Only waiting games can be cancelled from the lobby" },
        { status: 400 }
      );
    }

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cancel game error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel game" },
      { status: 500 }
    );
  }
}
