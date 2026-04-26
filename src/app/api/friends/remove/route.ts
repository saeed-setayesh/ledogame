import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const { friendId } = await request.json();

    if (!friendId) {
      return NextResponse.json(
        { error: "Friend ID is required" },
        { status: 400 }
      );
    }

    // Remove friendship (both directions)
    await prisma.friend.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId },
          { userId: friendId, friendId: user.id },
        ],
        status: "ACCEPTED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Remove friend error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove friend" },
      { status: 500 }
    );
  }
}
