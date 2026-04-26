import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { type, item } = await request.json()

    if (!type || !item) {
      return NextResponse.json(
        { error: "Type and item are required" },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { customizations: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Check user level requirements
    const levelRequirements: Record<string, number> = {
      "board-color-gold": 5,
      "board-color-diamond": 10,
      "piece-style-premium": 5,
      "piece-style-legendary": 10,
    }

    const requiredLevel = levelRequirements[item] || 1
    if (dbUser.level < requiredLevel) {
      return NextResponse.json(
        { error: `Level ${requiredLevel} required` },
        { status: 400 }
      )
    }

    // Update customizations
    if (!dbUser.customizations) {
      await prisma.userCustomization.create({
        data: {
          userId: user.id,
          unlockedBoardColors: type === "board" ? [item] : [],
          unlockedPieceStyles: type === "piece" ? [item] : [],
        },
      })
    } else {
      await prisma.userCustomization.update({
        where: { userId: user.id },
        data: {
          unlockedBoardColors:
            type === "board"
              ? [...(dbUser.customizations.unlockedBoardColors || []), item]
              : dbUser.customizations.unlockedBoardColors,
          unlockedPieceStyles:
            type === "piece"
              ? [...(dbUser.customizations.unlockedPieceStyles || []), item]
              : dbUser.customizations.unlockedPieceStyles,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Unlock customization error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to unlock" },
      { status: 500 }
    )
  }
}

