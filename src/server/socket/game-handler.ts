import { Socket, Server as SocketIOServer } from "socket.io";
import {
  getGameEngine,
  getGameState,
  updateGameState,
  loadGameFromDatabase,
  createGameState,
} from "@/lib/game/game-state";
import { prisma } from "@/lib/prisma";
import { deductEntryFee, processPayout } from "@/lib/blockchain/wallet";
import { AIPlayer } from "@/lib/game/ai-player";

export function gameHandlers(socket: Socket, io: SocketIOServer) {
  // Join game room
  socket.on("game:join", async ({ gameId, userId }) => {
    try {
      // Verify user is part of the game
      const gamePlayer = await prisma.gamePlayer.findFirst({
        where: {
          gameId,
          userId,
        },
        include: {
          game: true,
        },
      });

      if (!gamePlayer) {
        socket.emit("game:error", { message: "You are not part of this game" });
        return;
      }

      // Join room
      socket.join(`game:${gameId}`);

      // Load game state if not in memory
      let gameState = getGameState(gameId);
      if (!gameState) {
        gameState = await loadGameFromDatabase(gameId);

        // If still no game state and game is ACTIVE, try to recreate it
        if (!gameState && gamePlayer.game.status === "ACTIVE") {
          console.log(
            `[Game ${gameId}] Game state not found, recreating from database`
          );
          const allPlayers = await prisma.gamePlayer.findMany({
            where: { gameId },
            orderBy: { position: "asc" },
          });

          if (allPlayers.length >= 2) {
            const playersForEngine = allPlayers.map((p) => ({
              id: p.id,
              userId: p.userId,
              color: p.color as any,
              position: p.position,
            }));

            await createGameState(gameId, playersForEngine);
            gameState = getGameState(gameId);
          }
        }
      }

      if (!gameState) {
        socket.emit("game:error", {
          message:
            "Game state not available. Please wait for the game to start.",
        });
        return;
      }

      // Update player status
      await prisma.gamePlayer.update({
        where: { id: gamePlayer.id },
        data: {
          status: "ACTIVE",
          rejoinedAt: gamePlayer.status === "OFFLINE" ? new Date() : undefined,
        },
      });

      // Send current game state
      console.log(
        `[Game ${gameId}] Sending game state to ${userId} - currentTurn: ${gameState.currentTurn}, status: ${gameState.gameStatus}`
      );
      console.log(
        `[Game ${gameId}] Players in state:`,
        gameState.players.map((p, idx) => ({
          index: idx,
          id: p.id,
          userId: p.userId,
          position: p.position,
        }))
      );
      socket.emit("game:state", { gameState });

      // Notify other players
      socket.to(`game:${gameId}`).emit("game:player-joined", {
        playerId: gamePlayer.id,
        userId,
      });

      // Check if current player is AI and process their turn
      // Only process AI if it's actually an AI's turn
      if (gameState && gameState.gameStatus === "ACTIVE") {
        const currentTurnPlayer = gameState.players[gameState.currentTurn];
        if (
          currentTurnPlayer &&
          AIPlayer.isAIPlayer(currentTurnPlayer.userId)
        ) {
          console.log(
            `[Game ${gameId}] Current turn is AI (${currentTurnPlayer.userId}), processing AI turn`
          );
          await processAITurn(gameId, io);
        } else {
          console.log(
            `[Game ${gameId}] Current turn is human (${currentTurnPlayer?.userId}), not processing AI`
          );
        }
      }
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Leave game room
  socket.on("game:leave", async ({ gameId, userId }) => {
    try {
      socket.leave(`game:${gameId}`);

      const gamePlayer = await prisma.gamePlayer.findFirst({
        where: { gameId, userId },
      });

      if (gamePlayer) {
        await prisma.gamePlayer.update({
          where: { id: gamePlayer.id },
          data: {
            status: "OFFLINE",
            leftAt: new Date(),
          },
        });

        socket.to(`game:${gameId}`).emit("game:player-left", {
          playerId: gamePlayer.id,
          userId,
        });
      }
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Roll dice
  socket.on("game:roll-dice", async ({ gameId, userId }) => {
    console.log(
      `[Game ${gameId}] Roll dice request received from userId: ${userId}`
    );
    try {
      const engine = getGameEngine(gameId);
      if (!engine) {
        console.error(`[Game ${gameId}] Engine not found`);
        socket.emit("game:error", { message: "Game not found" });
        return;
      }

      const gameState = getGameState(gameId);
      if (!gameState) {
        console.error(`[Game ${gameId}] Game state not found`);
        socket.emit("game:error", { message: "Game state not found" });
        return;
      }

      console.log(
        `[Game ${gameId}] Game state loaded - currentTurn: ${gameState.currentTurn}, players: ${gameState.players.length}, status: ${gameState.gameStatus}`
      );
      console.log(
        `[Game ${gameId}] Players in engine state:`,
        gameState.players.map((p, idx) => ({
          index: idx,
          id: p.id,
          userId: p.userId,
          position: p.position,
          isCurrentTurn: idx === gameState.currentTurn,
        }))
      );

      const gamePlayer = await prisma.gamePlayer.findFirst({
        where: { gameId, userId },
      });

      if (!gamePlayer) {
        socket.emit("game:error", { message: "You are not part of this game" });
        return;
      }

      // Find the player in the engine state by userId (more reliable than ID matching)
      const enginePlayer = gameState.players.find((p) => p.userId === userId);
      if (!enginePlayer) {
        console.error(
          `[Game ${gameId}] Player not found in engine state. userId: ${userId}, players:`,
          gameState.players.map((p) => ({
            id: p.id,
            userId: p.userId,
            position: p.position,
          }))
        );
        socket.emit("game:error", {
          message: "Player not found in game state",
        });
        return;
      }

      // Verify it's actually their turn
      const currentTurnPlayer = gameState.players[gameState.currentTurn];
      if (!currentTurnPlayer) {
        console.error(
          `[Game ${gameId}] Invalid currentTurn index: ${gameState.currentTurn}, total players: ${gameState.players.length}`
        );
        socket.emit("game:error", { message: "Invalid game state" });
        return;
      }

      if (currentTurnPlayer.userId !== userId) {
        console.log(
          `[Game ${gameId}] ❌ TURN MISMATCH - Current turn index: ${gameState.currentTurn}, Current player: ${currentTurnPlayer.userId} (${currentTurnPlayer.id}), Requesting: ${userId} (${enginePlayer.id})`
        );
        console.log(
          `[Game ${gameId}] All players in state:`,
          gameState.players.map((p, idx) => ({
            index: idx,
            id: p.id,
            userId: p.userId,
            position: p.position,
            isCurrentTurn: idx === gameState.currentTurn,
          }))
        );
        const requestingPlayerIndex = gameState.players.findIndex(
          (p) => p.userId === userId
        );
        console.log(
          `[Game ${gameId}] Requesting player index: ${requestingPlayerIndex}, Current turn index: ${gameState.currentTurn}`
        );

        // Send updated state to client to sync IMMEDIATELY
        socket.emit("game:state", { gameState });

        // Also broadcast to room to ensure all clients are synced
        io.to(`game:${gameId}`).emit("game:state", { gameState });

        socket.emit("game:error", {
          message: `Not your turn. It's ${
            currentTurnPlayer.userId === "AI_0" ||
            currentTurnPlayer.userId?.startsWith("AI_")
              ? "AI"
              : "another player"
          }'s turn.`,
        });
        return;
      }

      console.log(
        `[Game ${gameId}] Valid roll request from ${userId} (player ${enginePlayer.id}), currentTurn: ${gameState.currentTurn}`
      );

      const diceValue = engine.rollDice(enginePlayer.id);
      const state = engine.getState();

      await updateGameState(gameId, state);

      // Broadcast to all players in room first
      io.to(`game:${gameId}`).emit("game:dice-rolled", {
        playerId: gamePlayer.id,
        diceValue,
        state,
      });

      // Calculate and send available moves to the current player (use engine player ID)
      const availableMoves = engine.getAvailableMoves(enginePlayer.id);
      const currentPlayerState = state.players[state.currentTurn];

      console.log(
        `[Game ${gameId}] Available moves for ${enginePlayer.id}: ${availableMoves.length}`
      );

      // Send available moves
      socket.emit("game:available-moves", { moves: availableMoves });

      // If no moves available, automatically skip turn after a delay
      // This happens when player rolled but can't make any moves (e.g., rolled 1-5 with all pieces in home)
      if (availableMoves.length === 0) {
        console.log(
          `[Game ${gameId}] Scheduling auto-skip for player ${enginePlayer.id} (${enginePlayer.userId}) - no moves available (dice: ${state.diceValue})`
        );

        // Store the player ID and userId to check later
        const playerIdToSkip = enginePlayer.id;
        const userIdToSkip = enginePlayer.userId;
        const gameIdToSkip = gameId;

        setTimeout(async () => {
          console.log(
            `[Game ${gameIdToSkip}] Auto-skip timeout triggered for ${userIdToSkip}`
          );

          const currentEngine = getGameEngine(gameIdToSkip);
          const currentState = getGameState(gameIdToSkip);
          if (!currentEngine || !currentState) {
            console.log(
              `[Game ${gameIdToSkip}] Auto-skip cancelled - engine or state not found. Engine: ${!!currentEngine}, State: ${!!currentState}`
            );
            return;
          }

          const stillCurrentPlayer =
            currentState.players[currentState.currentTurn];
          if (!stillCurrentPlayer) {
            console.log(
              `[Game ${gameIdToSkip}] Auto-skip cancelled - no current player at index ${currentState.currentTurn}`
            );
            return;
          }

          console.log(
            `[Game ${gameIdToSkip}] Auto-skip check - Current player: ${stillCurrentPlayer.userId}, Expected: ${userIdToSkip}, diceValue: ${currentState.diceValue}, status: ${currentState.gameStatus}`
          );

          // Check if it's still the same player's turn (by userId for reliability)
          const userIdMatch = stillCurrentPlayer.userId === userIdToSkip;
          const diceValueNotNull = currentState.diceValue !== null;
          const statusActive = currentState.gameStatus === "ACTIVE";
          if (userIdMatch && diceValueNotNull && statusActive) {
            // Re-check available moves to be sure (use the engine player ID)
            const currentAvailableMoves = currentEngine.getAvailableMoves(
              stillCurrentPlayer.id
            );
            console.log(
              `[Game ${gameIdToSkip}] Available moves check: ${currentAvailableMoves.length} moves available`
            );

            if (currentAvailableMoves.length === 0) {
              console.log(
                `[Game ${gameIdToSkip}] Executing auto-skip for player ${stillCurrentPlayer.id} (${userIdToSkip}) - no moves available`
              );

              // Force advance turn
              currentEngine.forceNextTurn();
              const finalState = currentEngine.getState();
              await updateGameState(gameIdToSkip, finalState);

              const nextPlayer = finalState.players[finalState.currentTurn];
              console.log(
                `[Game ${gameIdToSkip}] Turn advanced from ${stillCurrentPlayer.userId} to ${nextPlayer.userId} (index ${finalState.currentTurn})`
              );
              // Broadcast turn change
              io.to(`game:${gameIdToSkip}`).emit("game:state", {
                gameState: finalState,
              });

              // Clear available moves for all players
              io.to(`game:${gameIdToSkip}`).emit("game:available-moves", {
                moves: [],
              });
              // Check if next player is AI (with a small delay to ensure state is synced)
              setTimeout(async () => {
                await processAITurn(gameIdToSkip, io);
              }, 300);
            } else {
              console.log(
                `[Game ${gameIdToSkip}] Auto-skip cancelled - moves now available: ${currentAvailableMoves.length}`
              );
            }
          } else {
            console.log(
              `[Game ${gameIdToSkip}] Auto-skip cancelled - conditions not met. Current player: ${stillCurrentPlayer?.userId}, Expected: ${userIdToSkip}, diceValue: ${currentState?.diceValue}, status: ${currentState?.gameStatus}`
            );
          }
        }, 2000); // Give player 2 seconds to see they can't move
      }
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Move piece
  socket.on("game:move-piece", async ({ gameId, userId, pieceId }) => {
    try {
      const engine = getGameEngine(gameId);
      if (!engine) {
        socket.emit("game:error", { message: "Game not found" });
        return;
      }

      const gameState = getGameState(gameId);
      if (!gameState) {
        socket.emit("game:error", { message: "Game state not found" });
        return;
      }

      // Find the player in the engine state by userId
      const enginePlayer = gameState.players.find((p) => p.userId === userId);
      if (!enginePlayer) {
        socket.emit("game:error", {
          message: "Player not found in game state",
        });
        return;
      }

      // Verify it's actually their turn
      const currentTurnPlayer = gameState.players[gameState.currentTurn];
      if (currentTurnPlayer.userId !== userId) {
        socket.emit("game:error", { message: "Not your turn" });
        return;
      }

      const gamePlayer = await prisma.gamePlayer.findFirst({
        where: { gameId, userId },
      });

      if (!gamePlayer) {
        socket.emit("game:error", { message: "You are not part of this game" });
        return;
      }

      const isGameFinished = engine.movePiece(enginePlayer.id, pieceId);
      const state = engine.getState();

      await updateGameState(gameId, state);

      // Record move in database
      await prisma.gameMove.create({
        data: {
          gameId,
          playerId: userId,
          diceRoll: state.lastMove?.diceRoll || 0,
          moveType: "PIECE_MOVE",
          fromPosition: state.lastMove?.fromPosition || 0,
          toPosition: state.lastMove?.toPosition || 0,
        },
      });

      // Clear available moves for all players after a move
      // If player rolled 6, they get another turn but need to roll again first
      // If turn changed, new player needs to roll first
      io.to(`game:${gameId}`).emit("game:available-moves", { moves: [] });

      // Broadcast to all players
      io.to(`game:${gameId}`).emit("game:piece-moved", {
        playerId: enginePlayer.id,
        pieceId,
        state,
      });

      // If game finished, process payouts
      if (isGameFinished && state.winnerId) {
        await handleGameFinish(gameId, state.winnerId);
      } else {
        // Check if next player is AI and process their turn
        await processAITurn(gameId, io);
      }
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Get available moves
  const moveRequestTimers = new Map<string, NodeJS.Timeout>();
  socket.on("game:get-moves", ({ gameId, userId }) => {
    try {
      // Debounce move requests to prevent spam
      const key = `${gameId}-${userId}`;
      if (moveRequestTimers.has(key)) {
        clearTimeout(moveRequestTimers.get(key)!);
      }

      const timer = setTimeout(() => {
        const engine = getGameEngine(gameId);
        if (!engine) {
          socket.emit("game:error", { message: "Game not found" });
          moveRequestTimers.delete(key);
          return;
        }

        const gameState = getGameState(gameId);
        if (!gameState) {
          socket.emit("game:error", { message: "Game state not found" });
          moveRequestTimers.delete(key);
          return;
        }

        const gamePlayer = gameState.players.find((p) => p.userId === userId);
        if (!gamePlayer) {
          socket.emit("game:error", {
            message: "You are not part of this game",
          });
          moveRequestTimers.delete(key);
          return;
        }

        // Only send if it's the player's turn and they've rolled
        const isPlayerTurn =
          gameState.currentTurn === gameState.players.indexOf(gamePlayer);
        if (isPlayerTurn && gameState.diceValue !== null) {
          const availableMoves = engine.getAvailableMoves(gamePlayer.id);
          socket.emit("game:available-moves", { moves: availableMoves });
        } else {
          // Not their turn or haven't rolled, send empty moves
          socket.emit("game:available-moves", { moves: [] });
        }

        moveRequestTimers.delete(key);
      }, 100); // Debounce by 100ms

      moveRequestTimers.set(key, timer);
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Start game
  socket.on("game:start", async ({ gameId }) => {
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          players: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!game) {
        socket.emit("game:error", { message: "Game not found" });
        return;
      }

      // Deduct entry fees
      for (const player of game.players) {
        await deductEntryFee(
          player.userId,
          parseFloat(game.entryFee.toString()),
          gameId
        );
      }

      // Update game status
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "ACTIVE",
          startedAt: new Date(),
          totalPot: game.entryFee * BigInt(game.players.length),
        },
      });

      // Notify all players
      io.to(`game:${gameId}`).emit("game:started", { gameId });

      // Check if first player is AI and process their turn
      await processAITurn(gameId, io);
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });
}

// Track AI processing to prevent infinite loops
const aiProcessing = new Set<string>();

/**
 * Process AI player's turn
 * This function automatically handles AI moves
 */
async function processAITurn(gameId: string, io: SocketIOServer) {
  // Prevent concurrent AI processing for the same game
  if (aiProcessing.has(gameId)) {
    return;
  }

  try {
    aiProcessing.add(gameId);

    const engine = getGameEngine(gameId);
    if (!engine) {
      aiProcessing.delete(gameId);
      return;
    }

    const state = getGameState(gameId);
    if (!state || state.gameStatus !== "ACTIVE") {
      aiProcessing.delete(gameId);
      return;
    }

    const currentPlayer = state.players[state.currentTurn];
    if (!currentPlayer) {
      aiProcessing.delete(gameId);
      return;
    }

    // Check if current player is AI
    if (!AIPlayer.isAIPlayer(currentPlayer.userId)) {
      aiProcessing.delete(gameId);
      return; // Not an AI player, wait for human input
    }

    // Add a small delay to make AI moves visible (1-2 seconds)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    // Make AI decision
    const decision = AIPlayer.makeDecision(engine, state, currentPlayer.id);

    if (decision.action === "roll") {
      // AI rolls dice
      const diceValue = engine.rollDice(currentPlayer.id);
      const newState = engine.getState();
      await updateGameState(gameId, newState);

      // Broadcast dice roll
      io.to(`game:${gameId}`).emit("game:dice-rolled", {
        playerId: currentPlayer.id,
        diceValue,
        state: newState,
      });

      // Get available moves for AI
      const availableMoves = engine.getAvailableMoves(currentPlayer.id);

      // Send available moves (even if empty, for UI consistency)
      io.to(`game:${gameId}`).emit("game:available-moves", {
        moves: availableMoves,
      });

      if (availableMoves.length > 0) {
        // AI can move, make another decision after a short delay
        setTimeout(async () => {
          await processAITurn(gameId, io);
        }, 500);
      } else {
        // No moves available, force turn to end
        console.log(
          `[Game ${gameId}] AI ${currentPlayer.userId} has no moves, forcing next turn`
        );
        engine.forceNextTurn();
        const finalState = engine.getState();
        await updateGameState(gameId, finalState);

        // Broadcast turn change
        io.to(`game:${gameId}`).emit("game:state", {
          gameState: finalState,
        });

        // Clear available moves
        io.to(`game:${gameId}`).emit("game:available-moves", { moves: [] });

        // Check if next player is also AI
        setTimeout(async () => {
          await processAITurn(gameId, io);
        }, 500);
      }
    } else if (decision.action === "move" && decision.pieceId !== undefined) {
      // AI moves piece
      const isGameFinished = engine.movePiece(
        currentPlayer.id,
        decision.pieceId
      );
      const newState = engine.getState();
      await updateGameState(gameId, newState);

      // Record move in database
      await prisma.gameMove.create({
        data: {
          gameId,
          playerId: currentPlayer.userId,
          diceRoll: newState.lastMove?.diceRoll || 0,
          moveType: "PIECE_MOVE",
          fromPosition: newState.lastMove?.fromPosition || 0,
          toPosition: newState.lastMove?.toPosition || 0,
        },
      });

      // Broadcast move
      io.to(`game:${gameId}`).emit("game:piece-moved", {
        playerId: currentPlayer.id,
        pieceId: decision.pieceId,
        state: newState,
      });

      // Clear available moves
      io.to(`game:${gameId}`).emit("game:available-moves", { moves: [] });

      // If game finished, process payouts
      if (isGameFinished && newState.winnerId) {
        await handleGameFinish(gameId, newState.winnerId);
      } else {
        // If AI rolled 6, they get another turn
        // Otherwise, check if next player is AI
        setTimeout(async () => {
          await processAITurn(gameId, io);
        }, 500);
      }
    }
  } catch (error: any) {
    console.error("AI turn processing error:", error);
  } finally {
    aiProcessing.delete(gameId);
  }
}

async function handleGameFinish(gameId: string, winnerUserId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
    },
  });

  if (!game) return;

  // Calculate commission (17%)
  const totalPot = parseFloat(game.totalPot.toString());
  const commission = totalPot * 0.17;
  const payout = totalPot - commission;

  // Update game
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: "FINISHED",
      finishedAt: new Date(),
      winnerId: winnerUserId,
      commissionAmount: commission,
    },
  });

  // Update winner player
  await prisma.gamePlayer.updateMany({
    where: {
      gameId,
      userId: winnerUserId,
    },
    data: {
      isWinner: true,
      payoutAmount: payout,
      status: "FINISHED",
    },
  });

  // Process payout
  await processPayout(winnerUserId, payout, gameId);

  // Award XP to winner
  const winner = await prisma.user.findUnique({
    where: { id: winnerUserId },
  });

  if (winner) {
    const newXP = winner.xp + 100;
    const newLevel = Math.floor(newXP / 1000) + 1;

    await prisma.user.update({
      where: { id: winnerUserId },
      data: {
        xp: newXP,
        level: newLevel,
        totalWins: winner.totalWins + 1,
        totalGames: winner.totalGames + 1,
      },
    });
  }

  // Update other players' stats
  await prisma.user.updateMany({
    where: {
      id: {
        in: game.players
          .filter((p) => p.userId !== winnerUserId)
          .map((p) => p.userId),
      },
    },
    data: {
      totalGames: {
        increment: 1,
      },
    },
  });
}
