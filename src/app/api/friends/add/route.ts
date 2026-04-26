import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      )
    }

    // Find friend by username
    const friend = await prisma.user.findUnique({
      where: { username },
    })

    if (!friend) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    if (friend.id === user.id) {
      return NextResponse.json(
        { error: "Cannot add yourself as a friend" },
        { status: 400 }
      )
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: friend.id },
          { userId: friend.id, friendId: user.id },
        ],
      },
    })

    if (existingFriendship) {
      return NextResponse.json(
        { error: "Friendship already exists" },
        { status: 400 }
      )
    }

    // Create friend request
    await prisma.friend.create({
      data: {
        userId: user.id,
        friendId: friend.id,
        status: "PENDING",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Add friend error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to add friend" },
      { status: 500 }
    )
  }
}

