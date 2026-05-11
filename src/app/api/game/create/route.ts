import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateRoomId } from "@/lib/utils";
import { createGameState } from "@/lib/game/game-state";
import { getOrCreateAIUsers } from "@/lib/game/ai-user";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const {
      gameType,
      maxPlayers,
      playersPerTeam,
      entryFee,
      aiPlayers = 0,
      practiceMode = false,
      gameMode = "CLASSIC",
    } = await request.json();

    // In practice mode, skip validation and set defaults
    if (practiceMode) {
      // Practice mode: entry fee is 0, maxPlayers is auto-set
      if (!gameType || !aiPlayers) {
        return NextResponse.json(
          { error: "Missing required fields for practice mode" },
          { status: 400 }
        );
      }
    } else {
      // Normal mode: validate all fields
      if (!gameType || !maxPlayers || !entryFee) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Get admin settings for entry fee validation
      // Default values
      const DEFAULT_MIN_FEE = parseFloat(process.env.MIN_ENTRY_FEE || "1");
      const DEFAULT_MAX_FEE = parseFloat(process.env.MAX_ENTRY_FEE || "100");

      let minFee = DEFAULT_MIN_FEE;
      let maxFee = DEFAULT_MAX_FEE;

      // Validate entry fee against admin settings
      const fee = parseFloat(entryFee);
      if (fee < minFee || fee > maxFee) {
        return NextResponse.json(
          { error: `Entry fee must be between ${minFee} and ${maxFee} USDT` },
          { status: 400 }
        );
      }

      // Check user balance (skip for practice mode)
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletBalance: true },
      });

      if (!dbUser || parseFloat(dbUser.walletBalance.toString()) < fee) {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        );
      }
    }

    const roomId = generateRoomId();

    // Calculate AI count first (needed for finalMaxPlayers calculation)
    // In practice mode, require at least 1 AI player
    const aiCount = practiceMode
      ? Math.max(1, Math.min(aiPlayers, 3)) // Practice mode: 1-3 AI
      : Math.min(aiPlayers, maxPlayers - 1); // Normal mode: 0 to maxPlayers-1

    // In practice mode, maxPlayers is automatically set to creator + AI players
    const finalMaxPlayers = practiceMode ? 1 + aiCount : maxPlayers;

    // In practice mode, entry fee is 0
    const finalEntryFee = practiceMode ? 0 : parseFloat(entryFee);

    // Create game
    const game = await prisma.game.create({
      data: {
        roomId,
        gameType,
        gameMode: gameMode === "RUSH" ? "RUSH" : "CLASSIC",
        maxPlayers: finalMaxPlayers,
        playersPerTeam: gameType === "TEAM" ? playersPerTeam : null,
        entryFee: finalEntryFee,
        creatorId: user.id,
        status: "WAITING",
      },
    });

    // Add creator as first player
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"];
    const players = [];

    const creatorPlayer = await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: user.id,
        position: 0,
        color: colors[0] as any,
        status: "ACTIVE",
      },
    });
    players.push({
      id: creatorPlayer.id,
      userId: user.id,
      color: colors[0] as any,
      position: 0,
    });

    if (aiCount > 0) {
      const aiUsers = await getOrCreateAIUsers(aiCount);
      for (let i = 0; i < aiCount; i++) {
        const aiUser = aiUsers[i];
        const aiPlayer = await prisma.gamePlayer.create({
          data: {
            gameId: game.id,
            userId: aiUser.id,
            position: i + 1,
            color: colors[i + 1] as any,
            status: "ACTIVE",
          },
        });
        players.push({
          id: aiPlayer.id,
          userId: aiUser.id,
          color: colors[i + 1] as any,
          position: i + 1,
        });
      }
    }

    // Sort players by position to ensure correct order
    players.sort((a, b) => a.position - b.position);

    // Initialize game state with all players
    await createGameState(
      game.id,
      players,
      game.gameMode === "RUSH" ? "RUSH" : "CLASSIC"
    );

    console.log(
      `[Game ${game.id}] Created game state with players:`,
      players.map((p) => ({
        id: p.id,
        userId: p.userId,
        position: p.position,
        color: p.color,
      }))
    );

    // Start game if we have at least 2 players (minimum for Ludo)
    // In practice mode, always start immediately
    const minPlayers = 2;
    const shouldStart = practiceMode
      ? players.length >= minPlayers // Practice mode: start with 2+ players (creator + AI)
      : players.length >= minPlayers &&
        (players.length >= finalMaxPlayers || aiCount > 0);

    if (shouldStart) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: "ACTIVE",
          startedAt: new Date(),
        },
      });
      console.log(
        `[Game ${game.id}] ${
          practiceMode ? "Practice mode" : "Game"
        } started with ${players.length} players (${aiCount} AI)`
      );
    } else {
      console.log(
        `[Game ${game.id}] Game waiting for more players. Current: ${players.length}, Min: ${minPlayers}, Max: ${finalMaxPlayers}`
      );
    }

    return NextResponse.json({ game, playerId: creatorPlayer.id });
  } catch (error: any) {
    console.error("Create game error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create game" },
      { status: 500 }
    );
  }
}
