import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get top users by total wins
    const topUsers = await prisma.user.findMany({
      orderBy: [
        { totalWins: "desc" },
        { totalGames: "desc" },
        { level: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        username: true,
        totalWins: true,
        totalGames: true,
        level: true,
        xp: true,
      },
    });

    // Get current user's stats
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        totalWins: true,
        totalGames: true,
        level: true,
      },
    });

    // Get current user's rank
    const userRank = currentUser
      ? await prisma.user.count({
          where: {
            OR: [
              { totalWins: { gt: currentUser.totalWins } },
              {
                totalWins: currentUser.totalWins,
                totalGames: { gt: currentUser.totalGames },
              },
              {
                totalWins: currentUser.totalWins,
                totalGames: currentUser.totalGames,
                level: { gt: currentUser.level },
              },
            ],
          },
        })
      : 0;

    const currentUserRank = userRank + 1;

    return NextResponse.json({
      leaderboard: topUsers.map((u, index) => ({
        rank: index + 1,
        username: u.username,
        wins: u.totalWins,
        games: u.totalGames,
        level: u.level,
        winRate: u.totalGames > 0 ? (u.totalWins / u.totalGames) * 100 : 0,
      })),
      userRank: currentUserRank,
    });
  } catch (error: any) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
