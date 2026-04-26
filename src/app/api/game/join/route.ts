import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getGameState, getGameEngine } from "@/lib/game/game-state";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { gameId, roomId } = await request.json();

    if (!gameId && !roomId) {
      return NextResponse.json(
        { error: "Game ID or Room ID is required" },
        { status: 400 }
      );
    }

    // Find game
    const game = (await gameId)
      ? await prisma.game.findUnique({ where: { id: gameId } })
      : await prisma.game.findUnique({ where: { roomId } });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "WAITING") {
      return NextResponse.json(
        { error: "Game is not accepting new players" },
        { status: 400 }
      );
    }

    // Check if this is a practice mode game
    // Practice mode games have maxPlayers = 1 + AI count and are already active
    const existingPlayers = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
    });

    const hasAIPlayers = existingPlayers.some((p) =>
      p.userId.startsWith("AI_")
    );
    const hasCreator = existingPlayers.some((p) => p.userId === game.creatorId);

    // If game has AI players, creator, and is already active with maxPlayers matching (1 + AI count)
    // It's likely a practice mode game - prevent other joins
    if (
      hasAIPlayers &&
      hasCreator &&
      game.status === "ACTIVE" &&
      existingPlayers.length === game.maxPlayers
    ) {
      return NextResponse.json(
        {
          error:
            "This is a practice mode game. Only the creator and AI players can participate.",
        },
        { status: 400 }
      );
    }

    // Check if user is already in the game
    const existingPlayer = await prisma.gamePlayer.findFirst({
      where: {
        gameId: game.id,
        userId: user.id,
      },
    });

    if (existingPlayer) {
      return NextResponse.json({
        game,
        playerId: existingPlayer.id,
        message: "Already in game",
      });
    }

    // Check if game is full
    const playerCount = await prisma.gamePlayer.count({
      where: { gameId: game.id },
    });

    if (playerCount >= game.maxPlayers) {
      return NextResponse.json({ error: "Game is full" }, { status: 400 });
    }

    // Check user balance
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    });

    if (
      !dbUser ||
      parseFloat(dbUser.walletBalance.toString()) <
        parseFloat(game.entryFee.toString())
    ) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Assign color and position
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"];
    const usedColors = await prisma.gamePlayer.findMany({
      where: { gameId: game.id },
      select: { color: true },
    });

    const availableColors = colors.filter(
      (c) => !usedColors.some((uc) => uc.color === c)
    );

    const newPlayer = await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: user.id,
        position: playerCount,
        color: availableColors[0] as any,
        status: "ACTIVE",
      },
    });

    // Add player to game state
    const engine = getGameEngine(game.id);
    if (engine) {
      // TODO: Add player to engine state
    }

    // Check if game should start
    const totalPlayers = await prisma.gamePlayer.count({
      where: { gameId: game.id },
    });

    if (totalPlayers >= game.maxPlayers) {
      // Game is full, can start
      await prisma.game.update({
        where: { id: game.id },
        data: { status: "ACTIVE" },
      });
    }

    return NextResponse.json({ game, playerId: newPlayer.id });
  } catch (error: any) {
    console.error("Join game error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to join game" },
      { status: 500 }
    );
  }
}
