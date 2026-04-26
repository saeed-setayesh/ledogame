import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { avatar } = await request.json();

    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json(
        { error: "Avatar is required" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { avatar },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Avatar update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update avatar" },
      { status: 500 }
    );
  }
}
