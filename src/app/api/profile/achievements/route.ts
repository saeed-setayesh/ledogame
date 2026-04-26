import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        totalWins: true,
        totalGames: true,
        level: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ achievements: [] });
    }

    const achievements = [];

    // First Win
    if (dbUser.totalWins >= 1) {
      achievements.push({
        id: "first_win",
        name: "First Victory",
        description: "Win your first game",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "trophy",
      });
    }

    // 10 Wins
    if (dbUser.totalWins >= 10) {
      achievements.push({
        id: "ten_wins",
        name: "Decade of Wins",
        description: "Win 10 games",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "star",
      });
    } else {
      achievements.push({
        id: "ten_wins",
        name: "Decade of Wins",
        description: "Win 10 games",
        unlocked: false,
        progress: dbUser.totalWins,
        target: 10,
        icon: "star",
      });
    }

    // 50 Wins
    if (dbUser.totalWins >= 50) {
      achievements.push({
        id: "fifty_wins",
        name: "Half Century",
        description: "Win 50 games",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "medal",
      });
    } else {
      achievements.push({
        id: "fifty_wins",
        name: "Half Century",
        description: "Win 50 games",
        unlocked: false,
        progress: dbUser.totalWins,
        target: 50,
        icon: "medal",
      });
    }

    // 100 Wins
    if (dbUser.totalWins >= 100) {
      achievements.push({
        id: "hundred_wins",
        name: "Century Master",
        description: "Win 100 games",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "crown",
      });
    } else {
      achievements.push({
        id: "hundred_wins",
        name: "Century Master",
        description: "Win 100 games",
        unlocked: false,
        progress: dbUser.totalWins,
        target: 100,
        icon: "crown",
      });
    }

    // High Roller (based on games played)
    if (dbUser.totalGames >= 50) {
      achievements.push({
        id: "high_roller",
        name: "High Roller",
        description: "Play 50 games",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "dice",
      });
    } else {
      achievements.push({
        id: "high_roller",
        name: "High Roller",
        description: "Play 50 games",
        unlocked: false,
        progress: dbUser.totalGames,
        target: 50,
        icon: "dice",
      });
    }

    // Level achievements
    if (dbUser.level >= 10) {
      achievements.push({
        id: "level_10",
        name: "Level 10",
        description: "Reach level 10",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "arrow-up",
      });
    }

    if (dbUser.level >= 25) {
      achievements.push({
        id: "level_25",
        name: "Level 25",
        description: "Reach level 25",
        unlocked: true,
        unlockedAt: new Date().toISOString(),
        icon: "arrow-up",
      });
    }

    return NextResponse.json({ achievements });
  } catch (error: any) {
    console.error("Achievements error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get achievements" },
      { status: 500 }
    );
  }
}
