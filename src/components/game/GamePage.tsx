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
  game: GameView;
  currentUserId: string;
}

interface GameUserView {
  username?: string | null;
  avatar?: string | null;
  level?: number | null;
  countryCode?: string | null;
}

interface GamePlayerView {
  id: string;
  userId: string;
  user?: GameUserView | null;
}

interface GameView {
  id: string;
  status?: string;
  entryFee?: string | number | null;
  totalPot?: string | number | null;
  players?: GamePlayerView[];
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
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
  player: {
    userId: string;
    color: PlayerColor;
    pieces: Array<{ isFinished: boolean }>;
  };
  isTimerActive: boolean;
  isMe: boolean;
  game: GameView;
  gameState: LudoGameState;
  localVideo: LocalVideoState | null;
}) {
  const gamePlayer = game?.players?.find((p) => p.userId === player.userId);
  const user = gamePlayer?.user;
  const username =
    user?.username ||
    (AIPlayer.isAIPlayer(player.userId)
      ? AIPlayer.getAIUsername(player.userId)
      : "Player");
  const avatar = user?.avatar || "👤";
  const level = typeof user?.level === "number" ? user.level : 1;
  const finishedCount = player.pieces.filter((p) => p.isFinished).length;
  const showLive =
    isMe && localVideo?.enabled && localVideo.stream && isVideoLive(localVideo.stream);

  return (
    <div
      className="relative flex items-center gap-2 min-w-0 max-w-48 px-1 py-1"
      style={{
        filter: isTimerActive
          ? "drop-shadow(0 0 12px rgba(255,210,74,0.45))"
          : "none",
      }}
    >
      <div
        className="relative z-10 w-14 h-14 shrink-0 rounded-full overflow-hidden border-[5px] border-white bg-white"
        style={{
          boxShadow: `0 3px 10px rgba(0,0,0,0.45), inset 0 0 0 2px ${COLOR_MAP[player.color]}88`,
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
      <div className="min-w-0 flex-1 -ml-2 pt-1">
        <div className="pl-3 text-[14px] md:text-base font-serif font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] leading-tight truncate">
          Level {level}
        </div>
        <div className="relative h-7 min-w-[5.2rem] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.35)] overflow-hidden border border-white/80">
          <div
            className="absolute inset-y-0 right-0 w-[72%] rounded-l-full"
            style={{
              background: `linear-gradient(90deg, ${COLOR_MAP[player.color]}cc, ${COLOR_MAP[player.color]})`,
            }}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg leading-none" title={user?.countryCode || ""}>
            {flagEmoji(user?.countryCode)}
          </span>
        </div>
        <div className="pl-3 mt-0.5 text-[9px] font-semibold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] truncate">
          {username}
          <span className="ml-1 text-white/70">{finishedCount}/4</span>
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
    <div
      className="min-h-dvh relative flex flex-col overflow-hidden pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
      style={{
        background:
          "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.08), transparent 24%), linear-gradient(180deg, #333630 0%, #181b19 55%, #111312 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Top controls and logo */}
      <header className="relative z-40 mx-auto flex w-full max-w-[540px] items-start justify-center px-4 pt-2 pb-1">
        <div className="absolute left-4 top-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleExitGame}
            disabled={isLeaving}
            className="h-12 w-12 rounded-xl border-[3px] border-[#b94617] bg-linear-to-b from-[#ffb333] to-[#de3a16] text-[#7b1308] shadow-[0_4px_0_#6e2a11,0_7px_12px_rgba(0,0,0,0.4)] active:translate-y-0.5"
            aria-label="Exit"
          >
            <svg viewBox="0 0 24 24" className="m-auto h-8 w-8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex justify-center">
          <Image
            src="/game/logo-wide.png"
            alt="LUDINO"
            width={520}
            height={290}
            className="h-24 w-auto max-w-[58vw] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.65)]"
            unoptimized
            priority
          />
        </div>

        <div className="absolute right-4 top-5 flex flex-col items-center gap-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="h-12 w-12 rounded-xl border-[3px] border-[#b94617] bg-linear-to-b from-[#ffbd4a] to-[#b85b19] text-white shadow-[0_4px_0_#6e2a11,0_7px_12px_rgba(0,0,0,0.4)] active:translate-y-0.5"
                aria-label="Menu"
              >
                <svg viewBox="0 0 24 24" className="m-auto h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                  <path d="M5 7h14M5 12h14M5 17h14" />
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
          <div className="rounded-lg border-2 border-[#b94617] bg-linear-to-b from-[#ffca54] to-[#d94818] px-1.5 py-1 shadow-[0_3px_0_#6e2a11]">
            <ScreenRecorder gameId={game.id} iconSrc="/game/icons/record.png" />
          </div>
        </div>
      </header>

      <p className="relative z-10 text-center text-xs font-semibold text-white/75 tracking-wide px-4 py-1 shrink-0">
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
      <div className="relative z-10 flex-1 flex flex-col min-h-0 items-center justify-center gap-2 px-3 max-w-[560px] mx-auto w-full">

        {topPlayersList.length > 0 && (
          <div className="grid grid-cols-2 gap-2 w-full">
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

        <div className="flex items-center justify-center w-full my-1">
          <LudoBoard
            gameState={gameState}
            currentUserId={currentUserId}
            onMovePiece={handleMovePiece}
            availableMoves={availableMoves}
            isMyTurn={myMoveTurn}
          />
        </div>

        {bottomPlayersList.length > 0 && (
          <div className="grid grid-cols-2 gap-2 w-full">
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

      {/* Bottom control dock */}
      <div
        className="fixed bottom-4 left-1/2 z-30 grid w-[min(92vw,420px)] -translate-x-1/2 grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[1.65rem] border-[3px] border-[#f2a51e] bg-white px-4 py-2 shadow-[0_6px_0_#a84a13,0_12px_24px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center gap-2 justify-start">
          <VideoCall
            gameId={game.id}
            userId={currentUserId}
            compact
            onLocalVideoChange={setLocalVideo}
            players={
              game.players?.map((p) => ({
                id: p.id,
                userId: p.userId,
                username: p.user?.username,
              })) || []
            }
          />
        </div>

        <div className="relative -my-8 flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-[#ffc32d] bg-linear-to-b from-[#ef2a22] to-[#a80f13] shadow-[0_6px_0_#701012,0_10px_20px_rgba(0,0,0,0.5)]">
          <Dice
            variant="lacquer"
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

        <div className="flex min-w-0 items-center justify-end gap-1 text-[#9f2b21]" title={potLabel}>
          <span className="hidden text-xs font-semibold sm:inline">coin</span>
          <span className="text-3xl font-serif leading-none">
            {String(gameState.players.length)}
          </span>
        </div>
      </div>
    </div>
  );
}
