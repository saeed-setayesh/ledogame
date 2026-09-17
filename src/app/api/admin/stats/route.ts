import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

async function periodStats(gte: Date, lt: Date) {
  const [newUsers, games, deposits, withdrawals, commission] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte, lt } } }),
    prisma.game.count({ where: { createdAt: { gte, lt } } }),
    prisma.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", createdAt: { gte, lt } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "WITHDRAWAL", status: "COMPLETED", createdAt: { gte, lt } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "COMMISSION", status: "COMPLETED", createdAt: { gte, lt } },
      _sum: { amount: true },
    }),
  ])

  return {
    newUsers,
    games,
    deposits: deposits._sum.amount?.toNumber() || 0,
    withdrawals: withdrawals._sum.amount?.toNumber() || 0,
    commission: commission._sum.amount?.toNumber() || 0,
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      todayGames,
      todayDeposits,
      todayWithdrawals,
      todayCommission,
      todayActiveUsers,
      totalUsers,
      totalGames,
      totalDeposits,
      totalWithdrawals,
      totalCommission,
      thisMonth,
      lastMonth,
      monthlyTrendRaw,
    ] = await Promise.all([
      prisma.game.count({ where: { createdAt: { gte: today } } }),
      prisma.transaction.aggregate({
        where: { type: "DEPOSIT", status: "COMPLETED", createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "COMPLETED", createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "COMMISSION", status: "COMPLETED", createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.user.count({ where: { updatedAt: { gte: today } } }),
      prisma.user.count(),
      prisma.game.count(),
      prisma.transaction.aggregate({
        where: { type: "DEPOSIT", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "COMMISSION", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      periodStats(thisMonthStart, nextMonthStart),
      periodStats(lastMonthStart, thisMonthStart),
      // Last 6 months (including this one) of new-user signups, for a trend chart.
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1)
          return prisma.user
            .count({ where: { createdAt: { gte: start, lt: end } } })
            .then((count) => ({
              month: start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
              newUsers: count,
            }))
        })
      ),
    ])

    return NextResponse.json({
      today: {
        totalGames: todayGames,
        totalDeposits: todayDeposits._sum.amount?.toString() || "0",
        totalWithdrawals: todayWithdrawals._sum.amount?.toString() || "0",
        totalCommission: todayCommission._sum.amount?.toString() || "0",
        activeUsers: todayActiveUsers,
      },
      // Kept flat for older clients that read these fields directly.
      totalGames: todayGames,
      totalDeposits: todayDeposits._sum.amount?.toString() || "0",
      totalWithdrawals: todayWithdrawals._sum.amount?.toString() || "0",
      totalCommission: todayCommission._sum.amount?.toString() || "0",
      activeUsers: todayActiveUsers,
      overall: {
        totalUsers,
        totalGames,
        totalDeposits: totalDeposits._sum.amount?.toString() || "0",
        totalWithdrawals: totalWithdrawals._sum.amount?.toString() || "0",
        totalCommission: totalCommission._sum.amount?.toString() || "0",
      },
      thisMonth,
      lastMonth,
      growth: {
        newUsers: pctChange(thisMonth.newUsers, lastMonth.newUsers),
        games: pctChange(thisMonth.games, lastMonth.games),
        deposits: pctChange(thisMonth.deposits, lastMonth.deposits),
        withdrawals: pctChange(thisMonth.withdrawals, lastMonth.withdrawals),
        commission: pctChange(thisMonth.commission, lastMonth.commission),
      },
      monthlyTrend: monthlyTrendRaw,
    })
  } catch (error: any) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get stats" },
      { status: 500 }
    )
  }
}
