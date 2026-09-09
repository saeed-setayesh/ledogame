import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { collectEntryFeesAndStartGame } from "@/lib/wallet/game-payments";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { inviteId, accept } = await request.json();

    const invite = await prisma.gameInvite.findUnique({
      where: { id: inviteId },
      include: { game: { include: { players: true } } },
    });

    if (!invite || invite.receiverId !== user.id) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invite is no longer valid" },
        { status: 400 }
      );
    }

    if (!accept) {
      await prisma.gameInvite.update({
        where: { id: inviteId },
        data: { status: "REJECTED" },
      });
      if (invite.game?.status === "WAITING") {
        await prisma.game.update({
          where: { id: invite.gameId! },
          data: { status: "CANCELLED", finishedAt: new Date() },
        });
      }
      return NextResponse.json({ status: "declined" });
    }

    const game = invite.game;
    if (!game || game.status !== "WAITING") {
      await prisma.gameInvite.update({
        where: { id: inviteId },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "The game is no longer available" },
        { status: 400 }
      );
    }

    const fee = parseFloat(game.entryFee.toString());
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    });
    if (!me || parseFloat(me.walletBalance.toString()) < fee) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    if (!game.players.some((p) => p.userId === user.id)) {
      await prisma.gamePlayer.create({
        data: {
          gameId: game.id,
          userId: user.id,
          position: game.players.length,
          color: "BLUE",
          status: "ACTIVE",
        },
      });
    }

    await prisma.gameInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" },
    });

    try {
      await collectEntryFeesAndStartGame(game.id);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not start game" },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: "accepted", gameId: game.id });
  } catch (error: any) {
    console.error("Invite respond error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to respond" },
      { status: 500 }
    );
  }
}
