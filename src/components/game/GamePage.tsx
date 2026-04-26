"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket/client";
import LudoBoard from "./LudoBoard";
import TurnNotificationBar from "./TurnNotificationBar";
import GameNotification from "./GameNotification";
import VideoCall from "../video/VideoCall";
import ScreenRecorder from "./ScreenRecorder";
import Dice from "./Dice";
import { LudoGameState, PlayerColor } from "@/lib/game/ludo-engine";
import { AIPlayer } from "@/lib/game/ai-player";

interface GamePageProps {
  game: any;
  currentUserId: string;
}

const COLOR_MAP: Record<PlayerColor, string> = {
  RED: "#e74c3c",
  BLUE: "#3498db",
  GREEN: "#2ecc71",
  YELLOW: "#f1c40f",
};

function PlayerCard({
  player,
  isCurrentTurn,
  isMe,
  game,
}: {
  player: { userId: string; color: PlayerColor; pieces: any[] };
  isCurrentTurn: boolean;
  isMe: boolean;
  game: any;
}) {
  const gamePlayer = game?.players?.find((p: any) => p.userId === player.userId);
  const user = gamePlayer?.user;
  const username = user?.username || (AIPlayer.isAIPlayer(player.userId) ? AIPlayer.getAIUsername(player.userId) : "Player");
  const avatar = user?.avatar || "👤";
  const finishedCount = player.pieces.filter((p: any) => p.isFinished).length;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: "rgba(20,8,8,0.85)",
        border: `1px solid ${isCurrentTurn ? "rgba(255,215,0,0.4)" : "rgba(255,215,0,0.1)"}`,
        boxShadow: isCurrentTurn ? "0 0 12px rgba(255,215,0,0.2)" : "none",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{
          background: `linear-gradient(180deg, ${COLOR_MAP[player.color]}, ${COLOR_MAP[player.color]}99)`,
          border: "2px solid rgba(255,215,0,0.3)",
        }}
      >
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold truncate" style={{ color: "#ffd700" }}>
          {username}
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-60">
          <span>Lv.1</span>
          <span>•</span>
          <span>{finishedCount}/4</span>
        </div>
      </div>
    </div>
  );
}

export default function GamePage({ game, currentUserId }: GamePageProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<LudoGameState | null>(null);
  const [availableMoves, setAvailableMoves] = useState<number[]>([]);
  const [showNoMovesNotification, setShowNoMovesNotification] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("game:join", { gameId: game.id, userId: currentUserId });

    socket.on(
      "game:state",
      ({ gameState: state }: { gameState: LudoGameState }) => {
        setGameState(state);
        const playerIndex = state.players.findIndex(
          (p) => p.userId === currentUserId
        );
        const isMyTurn =
          playerIndex !== -1 && state.currentTurn === playerIndex;

        if (!isMyTurn) {
          setAvailableMoves([]);
        }
      }
    );

    socket.on("game:dice-rolled", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
      const playerIndex = state.players.findIndex(
        (p) => p.userId === currentUserId
      );
      const isMyTurn = playerIndex !== -1 && state.currentTurn === playerIndex;

      if (!isMyTurn) {
        setAvailableMoves([]);
      }
    });

    socket.on("game:piece-moved", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
      setAvailableMoves([]);
    });

    socket.on("game:available-moves", ({ moves }: { moves: number[] }) => {
      if (gameState) {
        const playerIndex = gameState.players.findIndex(
          (p) => p.userId === currentUserId
        );
        const isMyTurn =
          playerIndex !== -1 && gameState.currentTurn === playerIndex;

        if (isMyTurn) {
          setAvailableMoves(moves);
          if (moves.length === 0 && gameState.diceValue !== null) {
            setShowNoMovesNotification(true);
          }
        } else {
          setAvailableMoves([]);
        }
      } else {
        setAvailableMoves(moves);
      }
    });

    socket.on("game:error", ({ message }: { message: string }) => {
      console.error("[Client] Game error:", message);
      alert(message);
    });

    return () => {
      socket.emit("game:leave", { gameId: game.id, userId: currentUserId });
    };
  }, [game.id, currentUserId]);

  useEffect(() => {
    if (gameState) {
      const playerIndex = gameState.players.findIndex(
        (p) => p.userId === currentUserId
      );
      const isMyTurn =
        playerIndex !== -1 && gameState.currentTurn === playerIndex;
      if (!isMyTurn) {
        setAvailableMoves([]);
      }
    }
  }, [gameState, currentUserId]);

  const handleRollDice = () => {
    if (!gameState) return;

    const playerIndex = gameState.players.findIndex(
      (p) => p.userId === currentUserId
    );
    const isMyTurn =
      playerIndex !== -1 && gameState.currentTurn === playerIndex;
    const currentPlayer = gameState.players[playerIndex];
    const currentTurnPlayer = gameState.players[gameState.currentTurn];

    if (!isMyTurn) {
      alert(
        `Not your turn. It's ${
          currentTurnPlayer?.userId?.startsWith("AI_") ? "AI" : "another player"
        }'s turn.`
      );
      return;
    }

    if (currentPlayer?.hasRolled) return;

    const socket = getSocket();
    socket.emit("game:roll-dice", { gameId: game.id, userId: currentUserId });
  };

  const handleMovePiece = (pieceId: number) => {
    const socket = getSocket();
    socket.emit("game:move-piece", {
      gameId: game.id,
      userId: currentUserId,
      pieceId,
    });
  };

  const handleExitGame = () => {
    if (isLeaving) return;

    if (gameState && gameState.gameStatus === "ACTIVE") {
      const confirmed = window.confirm(
        "Are you sure you want to leave the game?"
      );
      if (!confirmed) return;
    }

    setIsLeaving(true);
    const socket = getSocket();
    socket.emit("game:leave", { gameId: game.id, userId: currentUserId });
    router.push("/lobby");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a0808" }}>
        <div className="text-center text-white">
          <div className="text-xl mb-4">Loading game...</div>
          {game.status === "WAITING" && (
            <div className="text-sm opacity-70">
              Waiting for more players to join...
            </div>
          )}
        </div>
      </div>
    );
  }

  const playerIndex = gameState.players.findIndex(
    (p) => p.userId === currentUserId
  );
  const currentPlayer =
    playerIndex !== -1 ? gameState.players[playerIndex] : null;
  const isMyTurn = playerIndex !== -1 && gameState.currentTurn === playerIndex;
  const isPracticeMode =
    gameState.players.some((p) => p.userId.startsWith("AI_")) &&
    gameState.players.length === 2;

  // Radial player layout: left column = index 0,1; right column = index 2,3
  const leftPlayers = gameState.players.slice(0, 2);
  const rightPlayers = gameState.players.slice(2, 4);

  return (
    <div
      className="min-h-screen relative flex flex-col pb-28 text-white overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #1a0808 0%, #2b0f0f 50%, #1a0808 100%)",
      }}
    >
      {/* Ornate red background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M30 5 Q35 20 30 35 Q25 20 30 5' fill='none' stroke='%23b83c3c' stroke-width='0.5' opacity='0.4'/%3E%3Ccircle cx='30' cy='30' r='5' fill='none' stroke='%23b83c3c' stroke-width='0.3' opacity='0.3'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Exit - minimal top-left */}
      <button
        onClick={handleExitGame}
        disabled={isLeaving}
        className="fixed top-4 left-4 z-50 w-10 h-10 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.4)" }}
        title="Exit"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Video/Recorder - top right */}
      <div className="fixed top-4 right-4 z-30 flex gap-2">
        <VideoCall
          gameId={game.id}
          userId={currentUserId}
          players={game.players?.map((p: any) => ({
            id: p.id,
            userId: p.userId,
            username: p.user?.username,
          })) || []}
        />
        <ScreenRecorder gameId={game.id} />
      </div>

      <GameNotification
        message="No moves available - Turn will skip"
        type="warning"
        duration={2500}
        show={showNoMovesNotification}
        onClose={() => setShowNoMovesNotification(false)}
      />

      {/* Main layout: players left | board | players right */}
      <div className="flex-1 flex items-center justify-center gap-2 md:gap-4 px-2 py-20 md:py-24">
        {/* Left player cards */}
        <div className="hidden sm:flex flex-col gap-2 w-24 md:w-28 shrink-0">
          {leftPlayers.map((player, idx) => (
            <PlayerCard
              key={player.userId}
              player={player}
              isCurrentTurn={gameState.currentTurn === gameState.players.indexOf(player)}
              isMe={player.userId === currentUserId}
              game={game}
            />
          ))}
        </div>

        {/* Board container - wooden frame */}
        <div
          className="relative rounded-2xl p-3 md:p-4 shrink-0"
          style={{
            background: "linear-gradient(180deg, #8b6914 0%, #6b4a0a 50%, #4a3308 100%)",
            boxShadow: "0 0 40px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)",
            border: "3px solid rgba(255,215,0,0.2)",
          }}
        >
          <div className="bg-amber-100/90 rounded-xl p-2 md:p-3">
            <LudoBoard
              gameState={gameState}
              currentUserId={currentUserId}
              onMovePiece={handleMovePiece}
              availableMoves={availableMoves}
            />
          </div>
        </div>

        {/* Right player cards */}
        <div className="hidden sm:flex flex-col gap-2 w-24 md:w-28 shrink-0">
          {rightPlayers.map((player) => (
            <PlayerCard
              key={player.userId}
              player={player}
              isCurrentTurn={gameState.currentTurn === gameState.players.indexOf(player)}
              isMe={player.userId === currentUserId}
              game={game}
            />
          ))}
        </div>
      </div>

      {/* Mobile: player strip above board */}
      <div className="sm:hidden flex justify-center gap-2 px-2 pb-2">
        {gameState.players.slice(0, 4).map((player) => (
          <PlayerCard
            key={player.userId}
            player={player}
            isCurrentTurn={gameState.currentTurn === gameState.players.indexOf(player)}
            isMe={player.userId === currentUserId}
            game={game}
          />
        ))}
      </div>

      {/* Dice area - white oval at bottom center (like the image) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div
          className="flex items-center justify-center px-8 py-4 rounded-full"
          style={{
            background: "linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
            border: "2px solid rgba(0,0,0,0.08)",
          }}
        >
          <Dice
            value={gameState.diceValue}
            onRoll={
              isMyTurn && !currentPlayer?.hasRolled ? handleRollDice : undefined
            }
            disabled={!isMyTurn || currentPlayer?.hasRolled || false}
            rolling={false}
            variant="white"
          />
        </div>
      </div>

      <TurnNotificationBar
        gameState={gameState}
        currentUserId={currentUserId}
        availableMoves={availableMoves}
        onRollDice={handleRollDice}
        isPracticeMode={isPracticeMode}
      />
    </div>
  );
}
