import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { friendId } = await request.json()

    if (!friendId) {
      return NextResponse.json(
        { error: "Friend ID is required" },
        { status: 400 }
      )
    }

    // Find pending friend request
    const friendship = await prisma.friend.findFirst({
      where: {
        userId: friendId,
        friendId: user.id,
        status: "PENDING",
      },
    })

    if (!friendship) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      )
    }

    // Accept friend request
    await prisma.friend.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED" },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Accept friend error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to accept friend" },
      { status: 500 }
    )
  }
}

