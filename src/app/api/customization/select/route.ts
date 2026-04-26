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

    if (!dbUser?.customizations) {
      return NextResponse.json(
        { error: "Customizations not found" },
        { status: 404 }
      )
    }

    // Verify item is unlocked
    const isUnlocked =
      type === "board"
        ? dbUser.customizations.unlockedBoardColors.includes(item) || item === "default"
        : dbUser.customizations.unlockedPieceStyles.includes(item) || item === "default"

    if (!isUnlocked) {
      return NextResponse.json(
        { error: "Item not unlocked" },
        { status: 400 }
      )
    }

    // Update selection
    await prisma.userCustomization.update({
      where: { userId: user.id },
      data:
        type === "board"
          ? { selectedBoardColor: item }
          : { selectedPieceStyle: item },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Select customization error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to select" },
      { status: 500 }
    )
  }
}

