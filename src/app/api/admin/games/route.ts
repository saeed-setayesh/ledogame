import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const status = searchParams.get("status");

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          winner: {
            select: {
              id: true,
              username: true,
            },
          },
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
        },
      }),
      prisma.game.count({ where }),
    ]);

    return NextResponse.json({
      games: games.map((game) => ({
        id: game.id,
        roomId: game.roomId,
        gameType: game.gameType,
        status: game.status,
        entryFee: game.entryFee.toString(),
        totalPot: game.totalPot.toString(),
        commissionAmount: game.commissionAmount.toString(),
        creator: game.creator,
        winner: game.winner,
        players: game.players.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          isWinner: p.isWinner,
          payoutAmount: p.payoutAmount.toString(),
        })),
        createdAt: game.createdAt.toISOString(),
        startedAt: game.startedAt?.toISOString(),
        finishedAt: game.finishedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get games error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get games" },
      { status: 500 }
    );
  }
}
