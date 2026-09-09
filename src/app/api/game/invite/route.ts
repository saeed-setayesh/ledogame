import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateRoomId } from "@/lib/utils";

const INVITE_TTL_MS = 2 * 60 * 1000;

/** List pending game invites the current user has received. */
export async function GET() {
  try {
    const user = await requireAuth();

    await prisma.gameInvite.updateMany({
      where: {
        receiverId: user.id,
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    const invites = await prisma.gameInvite.findMany({
      where: { receiverId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true, level: true },
        },
        game: { select: { status: true } },
      },
    });

    return NextResponse.json({
      invites: invites
        .filter((i) => i.game && i.game.status === "WAITING")
        .map((i) => ({
          id: i.id,
          gameId: i.gameId,
          entryFee: i.entryFee ? Number(i.entryFee) : 0,
          gameMode: i.gameMode,
          sender: i.sender,
          createdAt: i.createdAt,
        })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load invites" },
      { status: 500 }
    );
  }
}

/** Send a game invite to a friend. Creates a WAITING game seeded with the sender. */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { toUserId, entryFee, gameMode } = await request.json();

    if (!toUserId || toUserId === user.id) {
      return NextResponse.json({ error: "Invalid opponent" }, { status: 400 });
    }
    const fee = Number(entryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      return NextResponse.json({ error: "Invalid entry fee" }, { status: 400 });
    }
    const mode = gameMode === "RUSH" ? "RUSH" : "CLASSIC";

    const friendship = await prisma.friend.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: user.id, friendId: toUserId },
          { userId: toUserId, friendId: user.id },
        ],
      },
    });
    if (!friendship) {
      return NextResponse.json(
        { error: "You can only invite friends" },
        { status: 400 }
      );
    }

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    });
    if (!me || parseFloat(me.walletBalance.toString()) < fee) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Retire any earlier pending invite to the same friend + its ghost game.
    const stale = await prisma.gameInvite.findMany({
      where: { senderId: user.id, receiverId: toUserId, status: "PENDING" },
      select: { id: true, gameId: true },
    });
    if (stale.length) {
      await prisma.gameInvite.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { status: "EXPIRED" },
      });
      await prisma.game.updateMany({
        where: {
          id: { in: stale.map((s) => s.gameId).filter((g): g is string => !!g) },
          status: "WAITING",
        },
        data: { status: "CANCELLED", finishedAt: new Date() },
      });
    }

    const game = await prisma.game.create({
      data: {
        roomId: generateRoomId(),
        gameType: "SOLO",
        gameMode: mode,
        maxPlayers: 2,
        entryFee: fee,
        creatorId: user.id,
        status: "WAITING",
        players: {
          create: {
            userId: user.id,
            position: 0,
            color: "RED",
            status: "ACTIVE",
          },
        },
      },
    });

    const invite = await prisma.gameInvite.create({
      data: {
        gameId: game.id,
        senderId: user.id,
        receiverId: toUserId,
        status: "PENDING",
        entryFee: fee,
        gameType: "SOLO",
        gameMode: mode,
        maxPlayers: 2,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    return NextResponse.json({ inviteId: invite.id, gameId: game.id });
  } catch (error: any) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send invite" },
      { status: 500 }
    );
  }
}
