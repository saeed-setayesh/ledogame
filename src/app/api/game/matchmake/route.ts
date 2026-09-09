import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  matchmake,
  cancelMatchmaking,
} from "@/lib/game/matchmaking";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const { entryFee, gameMode, cancel } = body as {
      entryFee?: number;
      gameMode?: string;
      cancel?: boolean;
    };

    if (cancel) {
      await cancelMatchmaking(user.id);
      return NextResponse.json({ status: "cancelled" });
    }

    const fee = Number(entryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      return NextResponse.json({ error: "Invalid entry fee" }, { status: 400 });
    }
    const mode = gameMode === "RUSH" ? "RUSH" : "CLASSIC";

    const result = await matchmake(user.id, fee, mode);
    if (result.status === "error") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Matchmake error:", error);
    return NextResponse.json(
      { error: error.message || "Matchmaking failed" },
      { status: 500 }
    );
  }
}
