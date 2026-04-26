import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const games = await prisma.game.findMany({
      where: {
        players: {
          some: {
            userId: user.id,
          },
        },
        status: "FINISHED",
      },
      orderBy: { finishedAt: "desc" },
      take: limit,
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        winner: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const recentGames = games.map((game) => {
      const player = game.players.find((p) => p.userId === user.id);
      const isWinner = game.winnerId === user.id;

      return {
        id: game.id,
        roomId: game.roomId,
        gameType: game.gameType,
        entryFee: game.entryFee.toString(),
        totalPot: game.totalPot.toString(),
        result: isWinner ? "win" : "loss",
        payoutAmount: player?.payoutAmount.toString() || "0",
        finishedAt: game.finishedAt?.toISOString(),
        winner: game.winner
          ? {
              id: game.winner.id,
              username: game.winner.username,
            }
          : null,
        players: game.players.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          color: p.color,
          isWinner: p.isWinner,
        })),
      };
    });

    return NextResponse.json({ games: recentGames });
  } catch (error: any) {
    console.error("Recent games error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get recent games" },
      { status: 500 }
    );
  }
}
