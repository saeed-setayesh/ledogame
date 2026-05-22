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
import Link from "next/link";

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

const CLASSIC_TURN_MS = 45_000;
const RUSH_TURN_MS = 15_000;

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
  if (state.gameMode === "RUSH") {
    return !me.hasRolled && !me.mustMove;
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
  if (state.gameMode === "RUSH") {
    const me = state.players[idx];
    return me.mustMove && me.hasRolled;
  }
  return false;
}

function TurnRing({
  endsAt,
  turnMs,
}: {
  endsAt: string | null;
  turnMs: number;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setTick(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const frac = Math.min(1, left / turnMs);
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
        {isTimerActive && (
          <TurnRing
            endsAt={gameState.turnEndsAt}
            turnMs={
              gameState.gameMode === "RUSH" ? RUSH_TURN_MS : CLASSIC_TURN_MS
            }
          />
        )}
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
      if (state.gameMode === "RUSH" && !isMyMoveTurn(state, currentUserId)) {
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
  if (gameState.gameMode === "RUSH") {
    if (myRollTurn) {
      turnHint = "Your turn — roll";
    } else if (myMoveTurn) {
      turnHint = "Move a piece";
    } else {
      turnHint = "Playing…";
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
    if (gameState.gameMode === "RUSH") {
      const isMe = p.userId === currentUserId;
      if (!isMe) return false;
      return (
        (!p.hasRolled && !p.mustMove) || (p.mustMove && p.hasRolled)
      );
    }
    return false;
  };

  return (
    <div className="game-shell-bg min-h-dvh relative flex flex-col overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">

      {/* ── Header (no duplicate / floating icons) ── */}
      <header className="relative z-40 flex items-center justify-between gap-1.5 px-2 pt-2 pb-1 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleExitGame}
            disabled={isLeaving}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/45 border border-white/12 active:scale-95 transition-transform text-white/85"
            aria-label="Exit"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 17l-5-5 5-5" />
              <path d="M21 12H10" />
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </button>
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/45 border border-white/12 active:scale-95 transition-transform"
            aria-label="Rewards"
          >
            <Image src="/game/icons/key.png" alt="" width={30} height={30} unoptimized />
          </button>
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/45 border border-white/12 active:scale-95 transition-transform"
            aria-label="Achievements"
          >
            <Image src="/game/icons/star.png" alt="" width={28} height={28} unoptimized />
          </button>
        </div>

        <div className="flex-1 flex justify-center min-w-0 px-0.5">
          <Image
            src="/game/logo.png"
            alt="LUDINO"
            width={480}
            height={180}
            className="h-[5.75rem] sm:h-28 md:h-32 lg:h-36 w-auto max-w-[min(92vw,28rem)] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
            unoptimized
            priority
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/45 border border-white/12 active:scale-95 transition-transform text-[#e8b84a]"
                aria-label="Menu"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .55.22 1.05.59 1.41.37.37.86.59 1.41.59H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[170px] rounded-xl p-1.5 bg-zinc-900/95 border border-white/10 text-white text-sm shadow-2xl backdrop-blur-sm"
                sideOffset={6}
              >
                <DropdownMenu.Item asChild>
                  <Link
                    href="/wallet"
                    className="px-3 py-2 rounded-lg outline-none hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Image src="/game/icons/coin.png" alt="" width={18} height={18} unoptimized className="opacity-90" />
                    Wallet &amp; coins
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 rounded-lg cursor-default outline-none hover:bg-white/10"
                  onSelect={goLobby}
                >
                  Lobby
                </DropdownMenu.Item>
                <DropdownMenu.Item className="px-3 py-2 rounded-lg cursor-default outline-none hover:bg-white/10">
                  Sound (coming soon)
                </DropdownMenu.Item>
                {isPracticeMode && (
                  <DropdownMenu.Item className="px-3 py-2 rounded-lg cursor-default outline-none text-white/50">
                    Practice mode
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* ── Turn hint ── */}
      <p className="text-center text-xs font-semibold text-white/70 tracking-wide px-4 py-1 shrink-0">
        {turnHint}
      </p>

      <GameNotification
        message="No moves available - Turn will skip"
        type="warning"
        duration={2500}
        show={showNoMovesNotification}
        onClose={() => setShowNoMovesNotification(false)}
      />

      {/* ── Main area: players + board ── */}
      <div className="flex-1 flex flex-col min-h-0 items-center justify-center gap-2 px-2 max-w-3xl mx-auto w-full">

        {topPlayersList.length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap w-full">
            {topPlayersList.map((player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                isTimerActive={playerTimerActive(gameState.players.indexOf(player))}
                isMe={player.userId === currentUserId}
                game={game}
                gameState={gameState}
                localVideo={localVideo}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center w-full">
          <LudoBoard
            gameState={gameState}
            currentUserId={currentUserId}
            onMovePiece={handleMovePiece}
            availableMoves={availableMoves}
            isMyTurn={myMoveTurn}
          />
        </div>

        {bottomPlayersList.length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap w-full">
            {bottomPlayersList.map((player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                isTimerActive={playerTimerActive(gameState.players.indexOf(player))}
                isMe={player.userId === currentUserId}
                game={game}
                gameState={gameState}
                localVideo={localVideo}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom bar (single row, no duplicated icons) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 border-t border-white/8"
        style={{ background: "var(--game-bottom-bar)" }}
      >
        {/* Left: pot label */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-[10px] md:text-xs text-white/65 leading-tight truncate">
            {potLabel}
          </div>
          <ScreenRecorder gameId={game.id} iconSrc="/game/icons/record.png" />
        </div>

        {/* Center: dice */}
        <div className="flex justify-center items-center">
          <Dice
            value={
              gameState.gameMode === "RUSH"
                ? currentPlayer?.mustMove || currentPlayer?.hasRolled
                  ? currentPlayer?.diceValue ?? null
                  : null
                : gameState.diceValue
            }
            onRoll={
              myRollTurn && !currentPlayer?.hasRolled
                ? handleRollDice
                : undefined
            }
            disabled={
              gameState.gameMode === "RUSH"
                ? !myRollTurn || !!currentPlayer?.hasRolled
                : !myRollTurn || !!currentPlayer?.hasRolled
            }
          />
        </div>

        {/* Right: video controls only */}
        <div className="flex justify-end items-center">
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
