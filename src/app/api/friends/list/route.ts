import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await requireAuth()

    const friendships = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: user.id, status: "ACCEPTED" },
          { friendId: user.id, status: "ACCEPTED" },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true,
          },
        },
      },
    })

    const friends = friendships.map((f) => {
      const friendUser = f.userId === user.id ? f.friend : f.user
      return {
        id: friendUser.id,
        username: friendUser.username,
        avatar: friendUser.avatar,
        level: friendUser.level,
      }
    })

    // Outgoing friend requests this user has sent that are still pending.
    const sentPending = await prisma.friend.findMany({
      where: { userId: user.id, status: "PENDING" },
      include: {
        friend: {
          select: { id: true, username: true, avatar: true, level: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const sentRequests = sentPending.map((f) => ({
      id: f.friend.id,
      username: f.friend.username,
      avatar: f.friend.avatar,
      level: f.friend.level,
    }))

    return NextResponse.json({ friends, sentRequests })
  } catch (error: any) {
    console.error("List friends error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list friends" },
      { status: 500 }
    )
  }
}

