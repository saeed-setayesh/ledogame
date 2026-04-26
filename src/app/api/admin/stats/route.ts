import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await requireAdmin()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's stats
    const [totalGames, deposits, withdrawals, commission, activeUsers] = await Promise.all([
      prisma.game.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          type: "DEPOSIT",
          status: "COMPLETED",
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          type: "WITHDRAWAL",
          status: "COMPLETED",
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          type: "COMMISSION",
          status: "COMPLETED",
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.user.count({
        where: {
          updatedAt: {
            gte: today,
          },
        },
      }),
    ])

    return NextResponse.json({
      totalGames,
      totalDeposits: deposits._sum.amount?.toString() || "0",
      totalWithdrawals: withdrawals._sum.amount?.toString() || "0",
      totalCommission: commission._sum.amount?.toString() || "0",
      activeUsers,
    })
  } catch (error: any) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get stats" },
      { status: 500 }
    )
  }
}

