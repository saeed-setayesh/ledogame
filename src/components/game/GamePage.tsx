"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getSocket } from "@/lib/socket/client";
import LudoBoard from "./LudoBoard";
import GameNotification from "./GameNotification";
import VideoCall, { type LocalVideoState } from "../video/VideoCall";
import ScreenRecorder from "./ScreenRecorder";
import Dice from "./Dice";
import {
  LudoGameState,
  PlayerColor,
} from "@/lib/game/ludo-engine";
import { AIPlayer } from "@/lib/game/ai-player";
import Image from "next/image";
import { Trophy, Package } from "lucide-react";

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

const TURN_MS = 45_000;

function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "\u{1F3F3}";
  const upper = code.toUpperCase();
  const cp = [...upper].map((c) => 127397 + c.charCodeAt(0));
  try {
    return String.fromCodePoint(...cp);
  } catch {
    return "\u{1F3F3}";
  }
}

function isMyRollTurn(state: LudoGameState, userId: string): boolean {
  const idx = state.players.findIndex((p) => p.userId === userId);
  if (idx === -1) return false;
  const me = state.players[idx];
  if (state.gameMode === "RUSH" && state.rushPhase === "ROLL") {
    return !me.hasRolled;
  }
  if (state.gameMode === "CLASSIC") {
    return state.currentTurn === idx && !me.hasRolled;
  }
  return false;
}

function isMyMoveTurn(state: LudoGameState, userId: string): boolean {
  const idx = state.players.findIndex((p) => p.userId === userId);
  if (idx === -1) return false;
  if (state.gameMode === "CLASSIC") {
    return state.currentTurn === idx;
  }
  if (state.gameMode === "RUSH" && state.rushPhase === "MOVE") {
    return state.currentTurn === idx;
  }
  return false;
}

function TurnRing({ endsAt }: { endsAt: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setTick(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const frac = Math.min(1, left / TURN_MS);
  const r = 20;
  const c = 2 * Math.PI * r;
  const dashoffset = c * (1 - frac);

  return (
    <svg
      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
      viewBox="0 0 48 48"
      aria-hidden
    >
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="3"
      />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="rgba(120, 200, 160, 0.95)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={dashoffset}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

function PlayerCard({
  player,
  isTimerActive,
  isMe,
  game,
  gameState,
  localVideo,
}: {
  player: { userId: string; color: PlayerColor; pieces: any[] };
  isTimerActive: boolean;
  isMe: boolean;
  game: any;
  gameState: LudoGameState;
  localVideo: LocalVideoState | null;
}) {
  const gamePlayer = game?.players?.find((p: any) => p.userId === player.userId);
  const user = gamePlayer?.user;
  const username =
    user?.username ||
    (AIPlayer.isAIPlayer(player.userId)
      ? AIPlayer.getAIUsername(player.userId)
      : "Player");
  const avatar = user?.avatar || "👤";
  const level = typeof user?.level === "number" ? user.level : 1;
  const finishedCount = player.pieces.filter((p: any) => p.isFinished).length;
  const showLive =
    isMe && localVideo?.enabled && localVideo.stream && isVideoLive(localVideo.stream);

  return (
    <div
      className="flex items-center gap-2 px-2 py-2 rounded-xl min-w-0 max-w-[9.5rem]"
      style={{
        background: "var(--game-panel)",
        border: `1px solid ${isTimerActive ? "rgba(120,200,160,0.45)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: isTimerActive
          ? "0 0 12px rgba(80, 160, 120, 0.2)"
          : "none",
      }}
    >
      <div
        className="relative w-11 h-11 shrink-0 rounded-full overflow-hidden"
        style={{
          boxShadow: `inset 0 0 0 2px ${COLOR_MAP[player.color]}88`,
        }}
      >
        {isTimerActive && <TurnRing endsAt={gameState.turnEndsAt} />}
        {showLive && localVideo?.stream ? (
          <LiveAvatar stream={localVideo.stream} />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-lg"
            style={{
              background: `linear-gradient(180deg, ${COLOR_MAP[player.color]}, ${COLOR_MAP[player.color]}99)`,
            }}
          >
            {avatar}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-sm leading-none" title={user?.countryCode || ""}>
            {flagEmoji(user?.countryCode)}
          </span>
          <div className="text-[11px] font-bold truncate text-white/95">
            {username}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/55 mt-0.5">
          <span>Lv.{level}</span>
          <span>•</span>
          <span>{finishedCount}/4</span>
        </div>
      </div>
    </div>
  );
}

function isVideoLive(stream: MediaStream) {
  return stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
}

function LiveAvatar({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v) v.srcObject = stream;
    return () => {
      if (v) v.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
    />
  );
}

export default function GamePage({ game, currentUserId }: GamePageProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<LudoGameState | null>(null);
  const [availableMoves, setAvailableMoves] = useState<number[]>([]);
  const [showNoMovesNotification, setShowNoMovesNotification] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [localVideo, setLocalVideo] = useState<LocalVideoState | null>(null);
  const gameStateRef = useRef<LudoGameState | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("game:join", { gameId: game.id, userId: currentUserId });

    socket.on(
      "game:state",
      ({ gameState: state }: { gameState: LudoGameState }) => {
        setGameState(state);
        if (!isMyMoveTurn(state, currentUserId)) {
          setAvailableMoves([]);
        }
      }
    );

    socket.on("game:dice-rolled", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
      if (state.gameMode === "RUSH" && state.rushPhase === "ROLL") {
        setAvailableMoves([]);
      } else if (!isMyMoveTurn(state, currentUserId)) {
        setAvailableMoves([]);
      }
    });

    socket.on("game:piece-moved", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
      if (!isMyMoveTurn(state, currentUserId)) {
        setAvailableMoves([]);
      }
    });

    socket.on(
      "game:available-moves",
      (payload: { moves: number[]; forUserId?: string | null }) => {
        const { moves, forUserId } = payload;
        const st = gameStateRef.current;

        if (forUserId === null) {
          setAvailableMoves([]);
          return;
        }
        if (forUserId !== undefined) {
          if (forUserId !== currentUserId) {
            setAvailableMoves([]);
            return;
          }
          setAvailableMoves(moves);
          if (
            moves.length === 0 &&
            st?.gameMode === "CLASSIC" &&
            st.diceValue !== null
          ) {
            setShowNoMovesNotification(true);
          }
          return;
        }

        if (!st) {
          setAvailableMoves(moves);
          return;
        }
        if (isMyMoveTurn(st, currentUserId)) {
          setAvailableMoves(moves);
          if (
            moves.length === 0 &&
            st.gameMode === "CLASSIC" &&
            st.diceValue !== null
          ) {
            setShowNoMovesNotification(true);
          }
        } else {
          setAvailableMoves([]);
        }
      }
    );

    socket.on("game:error", ({ message }: { message: string }) => {
      console.error("[Client] Game error:", message);
      alert(message);
    });

    return () => {
      socket.emit("game:leave", { gameId: game.id, userId: currentUserId });
    };
  }, [game.id, currentUserId]);

  const handleRollDice = () => {
    if (!gameState) return;
    const idx = gameState.players.findIndex((p) => p.userId === currentUserId);
    const me = idx >= 0 ? gameState.players[idx] : null;

    if (!isMyRollTurn(gameState, currentUserId)) {
      alert("You cannot roll right now.");
      return;
    }
    if (me?.hasRolled && gameState.gameMode === "CLASSIC") return;

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

  const goLobby = () => {
    router.push("/lobby");
  };

  const potLabel = useMemo(() => {
    const n = gameState?.players.length ?? 0;
    const fee = game.entryFee ?? "0";
    const pot = game.totalPot ?? "0";
    return `${n} × ${fee} → Pot ${pot} USDT`;
  }, [game.entryFee, game.totalPot, gameState?.players.length]);

  if (!gameState) {
    return (
      <div className="game-shell-bg min-h-dvh flex items-center justify-center">
        <div className="text-center text-white/90">
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

  const myMoveTurn = isMyMoveTurn(gameState, currentUserId);
  const myRollTurn = isMyRollTurn(gameState, currentUserId);

  const isPracticeMode =
    gameState.players.some((p) => p.userId.startsWith("AI_")) &&
    gameState.players.length === 2;

  const midSeat = Math.ceil(gameState.players.length / 2);
  const topPlayersList = gameState.players.slice(0, midSeat);
  const bottomPlayersList = gameState.players.slice(midSeat);

  let turnHint = "";
  if (gameState.gameMode === "RUSH" && gameState.rushPhase === "ROLL") {
    turnHint =
      myRollTurn && !currentPlayer?.hasRolled
        ? "Roll your dice"
        : "Waiting for all players to roll…";
  } else if (gameState.gameMode === "RUSH" && gameState.rushPhase === "MOVE") {
    if (myMoveTurn) {
      turnHint =
        currentPlayer?.diceValue != null ? "Move a piece" : "…";
    } else {
      const cur = gameState.players[gameState.currentTurn];
      turnHint = `${cur?.userId?.startsWith("AI_") ? "AI" : "Opponent"} is moving`;
    }
  } else if (myRollTurn && !currentPlayer?.hasRolled) {
    turnHint = "Your turn — roll";
  } else if (myMoveTurn && availableMoves.length > 0) {
    turnHint = "Choose a piece";
  } else {
    const cur = gameState.players[gameState.currentTurn];
    turnHint = `${cur?.userId?.startsWith("AI_") ? "AI" : "Opponent"}'s turn`;
  }

  const playerTimerActive = (idx: number) => {
    const p = gameState.players[idx];
    if (gameState.gameMode === "CLASSIC") {
      return gameState.currentTurn === idx;
    }
    if (gameState.rushPhase === "ROLL") {
      return !p.hasRolled;
    }
    if (gameState.rushPhase === "MOVE") {
      return gameState.currentTurn === idx;
    }
    return false;
  };

  return (
    <div className="game-shell-bg min-h-dvh relative flex flex-col overflow-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="relative z-40 flex items-center justify-between gap-2 px-2 pt-2 max-w-3xl mx-auto w-full">
        <button
          type="button"
          onClick={handleExitGame}
          disabled={isLeaving}
          className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-b from-red-500 to-red-800 border border-red-950/40 shadow-md"
          aria-label="Exit game"
          title="Exit"
        >
          <Image src="/game/icons/exit.png" alt="" width={22} height={22} unoptimized />
        </button>

        <div
          className="flex-1 flex justify-center min-w-0 px-1"
          style={{
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
          }}
        >
          <div
            className="flex items-center justify-center px-6 py-2 rounded-xl max-w-[220px] w-full"
            style={{
              background:
                "linear-gradient(180deg, #7a5230 0%, #4a3018 45%, #2f1e10 100%)",
              border: "2px solid #3d2814",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 0 rgba(0,0,0,0.4)",
            }}
          >
            <Image
              src="/game/logo.png"
              alt="LUDINO"
              width={140}
              height={44}
              className="h-8 w-auto object-contain brightness-110 contrast-105"
              unoptimized
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-black/35 border border-white/12"
                aria-label="Settings"
              >
                <Image
                  src="/game/icons/settings.png"
                  alt=""
                  width={24}
                  height={24}
                  className="opacity-90"
                  unoptimized
                />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[180px] rounded-lg p-1 bg-zinc-900 border border-white/10 text-white text-sm shadow-xl"
                sideOffset={6}
              >
                <DropdownMenu.Item
                  className="px-3 py-2 rounded cursor-default outline-none hover:bg-white/10"
                  onSelect={goLobby}
                >
                  Lobby
                </DropdownMenu.Item>
                <DropdownMenu.Item className="px-3 py-2 rounded cursor-default outline-none hover:bg-white/10">
                  Sound (coming soon)
                </DropdownMenu.Item>
                {isPracticeMode && (
                  <DropdownMenu.Item className="px-3 py-2 rounded cursor-default outline-none text-white/60">
                    Practice mode
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            type="button"
            onClick={goLobby}
            className="min-h-11 px-3 flex items-center justify-center rounded-lg bg-gradient-to-b from-amber-400 to-amber-700 border border-amber-950/30 text-xs font-bold text-amber-950 shadow"
            title="Lobby"
          >
            <Image src="/game/icons/lobby.png" alt="" width={22} height={22} unoptimized />
          </button>
        </div>
      </header>

      <GameNotification
        message="No moves available - Turn will skip"
        type="warning"
        duration={2500}
        show={showNoMovesNotification}
        onClose={() => setShowNoMovesNotification(false)}
      />

      <p className="text-center text-xs text-white/55 px-4 py-1 shrink-0">
        {turnHint}
      </p>

      <div className="flex-1 flex flex-col min-h-0 items-stretch justify-center gap-1 px-1 md:px-3 max-w-3xl mx-auto w-full">
        <div className="flex justify-center gap-2 flex-wrap w-full py-1">
          {topPlayersList.map((player) => (
            <PlayerCard
              key={player.userId}
              player={player}
              isTimerActive={playerTimerActive(
                gameState.players.indexOf(player)
              )}
              isMe={player.userId === currentUserId}
              game={game}
              gameState={gameState}
              localVideo={localVideo}
            />
          ))}
        </div>

        <div
          className="flex-1 flex items-center justify-center min-h-0 py-1"
          style={{ minHeight: "min(72vw, 64dvh)" }}
        >
          <div
            className="relative w-full flex items-center justify-center p-2 md:p-3 rounded-3xl shrink-0"
            style={{
              background:
                "linear-gradient(145deg, #6b4a2c 0%, #3d2814 40%, #26180c 100%)",
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.1)",
              border: "3px solid #1f140a",
            }}
          >
            <LudoBoard
              gameState={gameState}
              currentUserId={currentUserId}
              onMovePiece={handleMovePiece}
              availableMoves={availableMoves}
              isMyTurn={myMoveTurn}
            />
          </div>
        </div>

        <div className="flex justify-center gap-2 flex-wrap w-full py-1">
          {bottomPlayersList.map((player) => (
            <PlayerCard
              key={player.userId}
              player={player}
              isTimerActive={playerTimerActive(
                gameState.players.indexOf(player)
              )}
              isMe={player.userId === currentUserId}
              game={game}
              gameState={gameState}
              localVideo={localVideo}
            />
          ))}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-between gap-2 px-2 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-white/8"
        style={{ background: "var(--game-bottom-bar)" }}
      >
        <div className="flex flex-col gap-2 shrink-0 max-w-[38%]">
          <div
            className="text-[10px] md:text-xs text-white/70 leading-tight px-2 py-1.5 rounded-lg bg-black/25 border border-white/6 select-none"
            title="Prize pool"
          >
            {potLabel}
          </div>
          <div className="flex items-center gap-2 px-1">
            <div
              className="h-11 w-11 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center"
              title="Trophy"
            >
              <Trophy className="w-6 h-6 text-amber-300" />
            </div>
            <div
              className="h-11 w-11 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center"
              title="Vault"
            >
              <Package className="w-6 h-6 text-amber-700" strokeWidth={1.75} />
            </div>
          </div>
          <ScreenRecorder gameId={game.id} iconSrc="/game/icons/record.png" />
        </div>

        <div className="flex-1 flex justify-center items-end overflow-x-auto">
          <div className="flex items-end justify-center gap-2 md:gap-3 px-2 py-1">
            {gameState.gameMode === "RUSH" ? (
              gameState.players.map((p, i) => (
                <Dice
                  key={p.id}
                  compact
                  label={p.color.slice(0, 1)}
                  value={
                    p.hasRolled || gameState.rushPhase === "MOVE"
                      ? p.diceValue
                      : null
                  }
                  onRoll={
                    p.userId === currentUserId &&
                    gameState.rushPhase === "ROLL" &&
                    !p.hasRolled
                      ? handleRollDice
                      : undefined
                  }
                  disabled={
                    p.userId !== currentUserId ||
                    gameState.rushPhase !== "ROLL" ||
                    p.hasRolled
                  }
                />
              ))
            ) : (
              <Dice
                ludino
                value={gameState.diceValue}
                onRoll={
                  myRollTurn && !currentPlayer?.hasRolled
                    ? handleRollDice
                    : undefined
                }
                disabled={!myRollTurn || !!currentPlayer?.hasRolled}
              />
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div
            className="rounded-xl bg-white/95 border border-black/10 px-3 py-2 shadow-md min-w-[5.5rem]"
            style={{ color: "#222" }}
          >
            <div className="text-[10px] font-extrabold tracking-wide text-black/80 uppercase">
              Live
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              {gameState.diceValue ?? "—"}
            </div>
          </div>
          <VideoCall
            gameId={game.id}
            userId={currentUserId}
            compact
            onLocalVideoChange={setLocalVideo}
            players={
              game.players?.map((p: any) => ({
                id: p.id,
                userId: p.userId,
                username: p.user?.username,
              })) || []
            }
          />
        </div>
      </div>
    </div>
  );
}
