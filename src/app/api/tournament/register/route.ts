import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { deductEntryFee } from "@/lib/blockchain/wallet"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { tournamentId } = await request.json()

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      )
    }

    if (tournament.status !== "UPCOMING" && tournament.status !== "LEADERBOARD_PHASE") {
      return NextResponse.json(
        { error: "Tournament is not accepting registrations" },
        { status: 400 }
      )
    }

    // Check if already registered
    const existingEntry = await prisma.tournamentEntry.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId: user.id,
        },
      },
    })

    if (existingEntry) {
      return NextResponse.json(
        { error: "Already registered" },
        { status: 400 }
      )
    }

    // Deduct entry fee
    await deductEntryFee(user.id, parseFloat(tournament.entryFee.toString()), tournamentId)

    // Create tournament entry
    await prisma.tournamentEntry.create({
      data: {
        tournamentId,
        userId: user.id,
        points: 0,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Tournament registration error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to register" },
      { status: 500 }
    )
  }
}

