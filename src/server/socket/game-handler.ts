import { Socket, Server as SocketIOServer } from "socket.io";
import {
  getGameEngine,
  getGameState,
  updateGameState,
  loadGameFromDatabase,
  createGameState,
} from "@/lib/game/game-state";
import { prisma } from "@/lib/prisma";
import { AIPlayer } from "@/lib/game/ai-player";
import {
  collectEntryFeesAndStartGame,
  settleGameWinner,
} from "@/lib/wallet/game-payments";

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

            await createGameState(
              gameId,
              playersForEngine,
              gamePlayer.game.gameMode === "RUSH" ? "RUSH" : "CLASSIC"
            );
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

      if (gameState && gameState.gameStatus === "ACTIVE") {
        setTimeout(() => void processAITurn(gameId, io), 300);
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

      const currentTurnPlayer = gameState.players[gameState.currentTurn];
      if (!currentTurnPlayer) {
        console.error(
          `[Game ${gameId}] Invalid currentTurn index: ${gameState.currentTurn}, total players: ${gameState.players.length}`
        );
        socket.emit("game:error", { message: "Invalid game state" });
        return;
      }

      if (gameState.gameMode === "RUSH") {
        if (enginePlayer.mustMove) {
          socket.emit("game:error", {
            message: "You must move a piece before rolling again",
          });
          return;
        }
        if (enginePlayer.hasRolled) {
          socket.emit("game:error", {
            message: "You already rolled this round",
          });
          return;
        }
      } else if (currentTurnPlayer.userId !== userId) {
        console.log(
          `[Game ${gameId}] ❌ TURN MISMATCH - Current turn index: ${gameState.currentTurn}, Current player: ${currentTurnPlayer.userId} (${currentTurnPlayer.id}), Requesting: ${userId} (${enginePlayer.id})`
        );
        socket.emit("game:state", { gameState });
        io.to(`game:${gameId}`).emit("game:state", { gameState });
        socket.emit("game:error", {
          message: `Not your turn. It's ${
            currentTurnPlayer.userId?.startsWith("AI_")
              ? "AI"
              : "another player"
          }'s turn.`,
        });
        return;
      }

      console.log(
        `[Game ${gameId}] Valid roll request from ${userId} (player ${enginePlayer.id})`
      );

      const diceValue = engine.rollDice(enginePlayer.id);
      await updateGameState(gameId, engine.getState());
      const state = getGameState(gameId)!;

      io.to(`game:${gameId}`).emit("game:dice-rolled", {
        playerId: gamePlayer.id,
        diceValue,
        state,
      });

      if (state.gameMode === "RUSH") {
        const rushMoves = engine.getAvailableMoves(enginePlayer.id);
        io.to(`game:${gameId}`).emit("game:available-moves", {
          moves: rushMoves,
          forUserId: enginePlayer.userId,
        });
        setTimeout(() => void processAITurn(gameId, io), 200);
        return;
      }

      const availableMoves = engine.getAvailableMoves(enginePlayer.id);

      console.log(
        `[Game ${gameId}] Available moves for ${enginePlayer.id}: ${availableMoves.length}`
      );

      socket.emit("game:available-moves", { moves: availableMoves });

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
          const isClassic = currentState.gameMode === "CLASSIC";
          if (
            isClassic &&
            userIdMatch &&
            diceValueNotNull &&
            statusActive
          ) {
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

              io.to(`game:${gameIdToSkip}`).emit("game:available-moves", {
                moves: [],
                forUserId: null,
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

      const currentTurnPlayer = gameState.players[gameState.currentTurn];

      if (gameState.gameMode === "RUSH") {
        if (!enginePlayer.mustMove) {
          socket.emit("game:error", {
            message: "Roll the dice before moving",
          });
          return;
        }
      } else if (currentTurnPlayer.userId !== userId) {
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
      await updateGameState(gameId, engine.getState());
      const state = getGameState(gameId)!;

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

      io.to(`game:${gameId}`).emit("game:available-moves", {
        moves: [],
        forUserId: null,
      });

      io.to(`game:${gameId}`).emit("game:piece-moved", {
        playerId: enginePlayer.id,
        pieceId,
        state,
      });

      if (state.gameMode === "RUSH" && !isGameFinished) {
        io.to(`game:${gameId}`).emit("game:available-moves", {
          moves: [],
          forUserId: enginePlayer.userId,
        });
      }

      if (isGameFinished && state.winnerId) {
        await handleGameFinish(gameId, state.winnerId);
      } else {
        setTimeout(() => void processAITurn(gameId, io), 200);
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

        const isPlayerTurn =
          gameState.currentTurn === gameState.players.indexOf(gamePlayer);
        let shouldSendMoves = false;
        if (gameState.gameMode === "CLASSIC") {
          shouldSendMoves =
            isPlayerTurn && gameState.diceValue !== null;
        } else if (gameState.gameMode === "RUSH") {
          shouldSendMoves =
            gamePlayer.mustMove && gamePlayer.diceValue !== null;
        }
        if (shouldSendMoves) {
          const availableMoves = engine.getAvailableMoves(gamePlayer.id);
          socket.emit("game:available-moves", { moves: availableMoves });
        } else {
          socket.emit("game:available-moves", { moves: [] });
        }

        moveRequestTimers.delete(key);
      }, 100); // Debounce by 100ms

      moveRequestTimers.set(key, timer);
    } catch (error: any) {
      socket.emit("game:error", { message: error.message });
    }
  });

  // Start game (creator only; collects entry fees atomically)
  socket.on("game:start", async ({ gameId, userId }) => {
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game) {
        socket.emit("game:error", { message: "Game not found" });
        return;
      }

      if (userId && game.creatorId !== userId) {
        socket.emit("game:error", {
          message: "Only the game creator can start the game",
        });
        return;
      }

      if (game.status !== "WAITING") {
        socket.emit("game:error", { message: "Game cannot be started" });
        return;
      }

      await collectEntryFeesAndStartGame(gameId);

      io.to(`game:${gameId}`).emit("game:started", { gameId });
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
  if (aiProcessing.has(gameId)) {
    return;
  }

  try {
    aiProcessing.add(gameId);

    const engine = getGameEngine(gameId);
    if (!engine) {
      return;
    }

    let state = getGameState(gameId);
    if (!state || state.gameStatus !== "ACTIVE") {
      return;
    }

    if (state.gameMode === "RUSH") {
      const aiPlayer = state.players.find(
        (p) =>
          AIPlayer.isAIPlayer(p.userId) &&
          (p.mustMove || (!p.hasRolled && !p.mustMove))
      );
      if (!aiPlayer) {
        return;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 600 + Math.random() * 600)
      );

      if (aiPlayer.mustMove) {
        const decision = AIPlayer.makeDecision(
          engine,
          state,
          aiPlayer.id
        );

        if (decision.action === "move" && decision.pieceId !== undefined) {
          const isGameFinished = engine.movePiece(
            aiPlayer.id,
            decision.pieceId
          );
          const newState = engine.getState();
          await updateGameState(gameId, newState);

          await prisma.gameMove.create({
            data: {
              gameId,
              playerId: aiPlayer.userId,
              diceRoll: newState.lastMove?.diceRoll || 0,
              moveType: "PIECE_MOVE",
              fromPosition: newState.lastMove?.fromPosition || 0,
              toPosition: newState.lastMove?.toPosition || 0,
            },
          });

          io.to(`game:${gameId}`).emit("game:piece-moved", {
            playerId: aiPlayer.id,
            pieceId: decision.pieceId,
            state: newState,
          });

          io.to(`game:${gameId}`).emit("game:available-moves", {
            moves: [],
            forUserId: aiPlayer.userId,
          });

          if (isGameFinished && newState.winnerId) {
            await handleGameFinish(gameId, newState.winnerId);
          } else {
            setTimeout(() => void processAITurn(gameId, io), 200);
          }
        }
        return;
      }

      const diceValue = engine.rollDice(aiPlayer.id);
      state = engine.getState();
      await updateGameState(gameId, state);

      io.to(`game:${gameId}`).emit("game:dice-rolled", {
        playerId: aiPlayer.id,
        diceValue,
        state,
      });

      const moves = engine.getAvailableMoves(aiPlayer.id);
      io.to(`game:${gameId}`).emit("game:available-moves", {
        moves,
        forUserId: aiPlayer.userId,
      });

      if (moves.length > 0) {
        setTimeout(() => void processAITurn(gameId, io), 400);
      } else {
        setTimeout(() => void processAITurn(gameId, io), 200);
      }
      return;
    }

    const currentPlayer = state.players[state.currentTurn];
    if (!currentPlayer) {
      return;
    }

    if (!AIPlayer.isAIPlayer(currentPlayer.userId)) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    const decision = AIPlayer.makeDecision(engine, state, currentPlayer.id);

    if (decision.action === "roll") {
      const diceValue = engine.rollDice(currentPlayer.id);
      const newState = engine.getState();
      await updateGameState(gameId, newState);

      io.to(`game:${gameId}`).emit("game:dice-rolled", {
        playerId: currentPlayer.id,
        diceValue,
        state: newState,
      });

      const availableMoves = engine.getAvailableMoves(currentPlayer.id);

      io.to(`game:${gameId}`).emit("game:available-moves", {
        moves: availableMoves,
        forUserId: currentPlayer.userId,
      });

      if (availableMoves.length > 0) {
        setTimeout(() => void processAITurn(gameId, io), 500);
      } else {
        console.log(
          `[Game ${gameId}] AI ${currentPlayer.userId} has no moves, forcing next turn`
        );
        engine.forceNextTurn();
        const finalState = engine.getState();
        await updateGameState(gameId, finalState);

        io.to(`game:${gameId}`).emit("game:state", {
          gameState: finalState,
        });

        io.to(`game:${gameId}`).emit("game:available-moves", {
          moves: [],
          forUserId: null,
        });

        setTimeout(() => void processAITurn(gameId, io), 500);
      }
    } else if (decision.action === "move" && decision.pieceId !== undefined) {
      const isGameFinished = engine.movePiece(
        currentPlayer.id,
        decision.pieceId
      );
      const newState = engine.getState();
      await updateGameState(gameId, newState);

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

      io.to(`game:${gameId}`).emit("game:piece-moved", {
        playerId: currentPlayer.id,
        pieceId: decision.pieceId,
        state: newState,
      });

      io.to(`game:${gameId}`).emit("game:available-moves", {
        moves: [],
        forUserId: null,
      });

      if (isGameFinished && newState.winnerId) {
        await handleGameFinish(gameId, newState.winnerId);
      } else {
        setTimeout(() => void processAITurn(gameId, io), 500);
      }
    }
  } catch (error: any) {
    console.error("AI turn processing error:", error);
  } finally {
    aiProcessing.delete(gameId);
  }
}

async function handleGameFinish(gameId: string, winnerUserId: string) {
  await settleGameWinner(gameId, winnerUserId);
}
