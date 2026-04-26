import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const { name, month, year, entryFee, startDate, endDate } = await request.json()

    const tournament = await prisma.tournament.create({
      data: {
        name,
        month,
        year,
        entryFee: parseFloat(entryFee),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "UPCOMING",
        type: "BOTH",
      },
    })

    return NextResponse.json({ tournament })
  } catch (error: any) {
    console.error("Create tournament error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create tournament" },
      { status: 500 }
    )
  }
}

