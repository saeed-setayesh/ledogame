import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    // Get pending friend requests where current user is the receiver
    const requests = await prisma.friend.findMany({
      where: {
        friendId: user.id,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            level: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        sender: {
          id: r.user.id,
          username: r.user.username,
          level: r.user.level,
          avatar: r.user.avatar,
        },
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("Friend requests error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get friend requests" },
      { status: 500 }
    );
  }
}
