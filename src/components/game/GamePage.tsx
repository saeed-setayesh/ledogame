"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getSocket } from "@/lib/socket/client";
import LudoBoard from "./LudoBoard";
import VideoCall, {
  type LocalVideoState,
  type PeerAudioState,
} from "../video/VideoCall";
import ScreenRecorder from "./ScreenRecorder";
import Dice from "./Dice";
import { cn } from "@/lib/utils";
import {
  LudoGameState,
  PlayerColor,
} from "@/lib/game/ludo-engine";
import { FINISH_PROGRESS } from "@/lib/game/ludo-track-cells";
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

const CLASSIC_TURN_MS = 20_000;
const RUSH_TURN_MS = 15_000;

interface FinishInfo {
  winnerUserId: string | null;
  winnerUsername: string | null;
  payout: number;
  totalPot: number;
  entryFee: number;
  cancelled?: boolean;
}

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

/**
 * Which of my pieces can move right now, computed straight from game state.
 * The server also broadcasts this, but its per-user targeting is unreliable in
 * RUSH (parallel play) — deriving it locally keeps my highlights correct
 * regardless of what other players are doing.
 */
function getMyAvailableMoves(
  state: LudoGameState,
  userId: string
): number[] {
  const idx = state.players.findIndex((p) => p.userId === userId);
  if (idx === -1) return [];
  const me = state.players[idx];

  let dice: number | null;
  if (state.gameMode === "RUSH") {
    if (!me.mustMove || !me.hasRolled) return [];
    dice = me.diceValue;
  } else {
    if (state.currentTurn !== idx || !me.hasRolled) return [];
    dice = state.diceValue ?? me.diceValue ?? null;
  }
  if (dice == null) return [];

  const moves: number[] = [];
  for (const pc of me.pieces) {
    if (pc.isFinished) continue;
    if (pc.isHome) {
      if (dice === 6) moves.push(pc.id);
    } else if (pc.position >= 0 && pc.position + dice <= FINISH_PROGRESS) {
      moves.push(pc.id);
    }
  }
  return moves;
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

function useSecondsLeft(endsAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

function PlayerCard({
  player,
  isTimerActive,
  isMe,
  game,
  gameState,
  localVideo,
  peerAudio,
  myMicOn,
}: {
  player: {
    userId: string;
    color: PlayerColor;
    pieces: Array<{ isFinished: boolean }>;
    hasRolled?: boolean;
    mustMove?: boolean;
    diceValue?: number | null;
  };
  isTimerActive: boolean;
  isMe: boolean;
  game: GameView;
  gameState: LudoGameState;
  localVideo: LocalVideoState | null;
  peerAudio: PeerAudioState[];
  myMicOn: boolean;
}) {
  const peer = peerAudio.find((p) => p.userId === player.userId);
  const voiceOn = isMe ? myMicOn : !!peer?.speakingAudio;
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

  // Show each player their own die.
  //  RUSH: always visible (parallel play).
  //  CLASSIC: on the player whose turn it is, so you can see the bot / opponent
  //  roll and what number they got.
  const isCurrentTurn =
    gameState.players[gameState.currentTurn]?.userId === player.userId;
  const showDie =
    gameState.gameMode === "RUSH" || (gameState.gameMode === "CLASSIC" && isCurrentTurn);
  const dieValue =
    gameState.gameMode === "RUSH"
      ? player.hasRolled || player.mustMove
        ? player.diceValue ?? null
        : null
      : isCurrentTurn
        ? player.diceValue ?? gameState.diceValue ?? null
        : null;
  const dieRolling =
    showDie &&
    dieValue === null &&
    (isCurrentTurn || player.mustMove) &&
    !player.hasRolled;

  return (
    <div
      className="relative flex items-center gap-2 min-w-0 max-w-48 px-1 py-1"
      style={{
        filter: isTimerActive
          ? "drop-shadow(0 0 12px rgba(255,210,74,0.45))"
          : "none",
      }}
    >
      {showDie && (
        <div
          className={cn(
            "absolute left-[2.6rem] top-[2.6rem] z-20 flex h-6 w-6 items-center justify-center rounded-md border-2 bg-white text-[11px] font-serif font-bold leading-none text-[#2b2b2b] shadow-[0_1px_4px_rgba(0,0,0,0.55)]",
            dieRolling && "animate-pulse"
          )}
          style={{ borderColor: COLOR_MAP[player.color] }}
          title={`${username}'s die`}
        >
          {dieValue ?? "🎲"}
        </div>
      )}
      {voiceOn && (
        <div
          className="absolute -left-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] ring-2 ring-white shadow"
          title={isMe ? "Your mic is on" : `${username} is on voice`}
        >
          🎤
        </div>
      )}
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

function FinishOverlay({
  info,
  currentUserId,
  onLobby,
}: {
  info: FinishInfo;
  currentUserId: string;
  onLobby: () => void;
}) {
  const iWon = info.winnerUserId === currentUserId;
  const cancelled = info.cancelled || !info.winnerUserId;

  let title: string;
  let sub: string;
  if (cancelled) {
    title = "Game ended";
    sub =
      info.entryFee > 0
        ? "Opponents left — your entry fee was refunded."
        : "The game was ended early.";
  } else if (iWon) {
    title = "🏆 You win!";
    sub =
      info.payout > 0
        ? `+${info.payout.toFixed(2)} USDT added to your balance`
        : "Great game!";
  } else {
    title = "You lost";
    sub =
      info.entryFee > 0
        ? `${info.winnerUsername ?? "Your opponent"} won the ${info.totalPot.toFixed(
            2
          )} USDT pot`
        : `${info.winnerUsername ?? "Your opponent"} finished first`;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-2xl border-2 border-[#f2a51e] bg-zinc-900 p-6 text-center shadow-2xl">
        <div className="text-2xl font-extrabold text-white">{title}</div>
        <div className="mt-2 text-sm text-white/70">{sub}</div>
        <button
          type="button"
          onClick={onLobby}
          className="mt-6 w-full rounded-xl bg-linear-to-r from-[#ffb333] to-[#de3a16] py-3 font-bold text-white shadow-lg active:scale-95"
        >
          Back to lobby
        </button>
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
  const [localVideo, setLocalVideo] = useState<LocalVideoState | null>(null);
  const [finishInfo, setFinishInfo] = useState<FinishInfo | null>(null);
  const [bonusToast, setBonusToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [peerAudio, setPeerAudio] = useState<PeerAudioState[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Derive my movable pieces from state on every update — authoritative and
  // race-free (works for RUSH parallel play, unlike the server's per-user push).
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== "ACTIVE") {
      setAvailableMoves([]);
      return;
    }
    const moves = getMyAvailableMoves(gameState, currentUserId);
    setAvailableMoves(moves);

    const myIdx = gameState.players.findIndex(
      (p) => p.userId === currentUserId
    );
    const me = myIdx >= 0 ? gameState.players[myIdx] : null;
    const iAmStuck =
      gameState.gameMode === "CLASSIC" &&
      gameState.currentTurn === myIdx &&
      !!me?.hasRolled &&
      gameState.diceValue !== null &&
      moves.length === 0;
    setShowNoMovesNotification(iAmStuck);
  }, [gameState, currentUserId]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("ludino:soundEnabled");
      if (v !== null) setSoundEnabled(v === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((s) => {
      const next = !s;
      try {
        localStorage.setItem("ludino:soundEnabled", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handlePeersChange = useCallback(
    (peers: PeerAudioState[]) => setPeerAudio(peers),
    []
  );

  const turnActive = gameState?.gameStatus === "ACTIVE";
  const secondsLeft = useSecondsLeft(
    turnActive ? gameState?.turnEndsAt ?? null : null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>).__ludo = {
      gameState,
      availableMoves,
      currentUserId,
      finishInfo,
      roll: () =>
        getSocket().emit("game:roll-dice", {
          gameId: game.id,
          userId: currentUserId,
        }),
      move: (pieceId: number) =>
        getSocket().emit("game:move-piece", {
          gameId: game.id,
          userId: currentUserId,
          pieceId,
        }),
    };
  }, [gameState, availableMoves, currentUserId, finishInfo, game.id]);

  useEffect(() => {
    const socket = getSocket();

    const joinGame = () =>
      socket.emit("game:join", { gameId: game.id, userId: currentUserId });
    joinGame();
    // Re-join and re-sync after any socket reconnect (server restart, network drop).
    socket.on("connect", joinGame);

    // availableMoves is derived from gameState in a separate effect, so these
    // handlers only need to keep gameState fresh.
    socket.on(
      "game:state",
      ({ gameState: state }: { gameState: LudoGameState }) => {
        setGameState(state);
      }
    );

    socket.on("game:dice-rolled", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
    });

    socket.on("game:piece-moved", ({ state }: { state: LudoGameState }) => {
      setGameState(state);
      const lm = state.lastMove;
      if (lm && lm.bonusRoll && lm.playerId) {
        const mover = state.players.find((p) => p.id === lm.playerId);
        if (mover?.userId === currentUserId) {
          setBonusToast(
            lm.captured
              ? "Capture! Roll again 🎲"
              : lm.diceRoll === 6
                ? "Rolled a 6 — roll again 🎲"
                : "Piece home! Roll again 🎲"
          );
          window.setTimeout(() => setBonusToast(null), 2200);
        }
      }
    });

    socket.on("game:finished", (info: FinishInfo) => {
      setFinishInfo(info);
    });

    socket.on("game:error", ({ message }: { message: string }) => {
      console.warn("[Client] Game error:", message);
      // Timing races (double-tap, turn just changed) produce these constantly —
      // they're self-correcting, so don't nag the player with a popup.
      const benign =
        /not your turn|must roll|already rolled|roll the dice|must move/i.test(
          message
        );
      if (!benign) {
        setErrorToast(message);
        window.setTimeout(() => setErrorToast(null), 3000);
      }
    });

    return () => {
      socket.emit("game:leave", { gameId: game.id, userId: currentUserId });
      socket.off("connect", joinGame);
      socket.off("game:state");
      socket.off("game:dice-rolled");
      socket.off("game:piece-moved");
      socket.off("game:finished");
      socket.off("game:error");
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

  // Seat each player at the board corner that matches their pawn colour, so the
  // profile card colour/position always lines up with their pieces on the board.
  const seatOrder: PlayerColor[][] = [
    ["BLUE", "GREEN"], // top row  (top-left, top-right)
    ["RED", "YELLOW"], // bottom row (bottom-left, bottom-right)
  ];
  const bySlot = (row: PlayerColor[]) =>
    row
      .map((color) => gameState.players.find((p) => p.color === color) ?? null)
      .filter((p): p is (typeof gameState.players)[number] => p !== null);
  const topPlayersList = bySlot(seatOrder[0]);
  const bottomPlayersList = bySlot(seatOrder[1]);

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
                <DropdownMenu.Item
                  className="px-3 py-2 rounded-lg cursor-default outline-none hover:bg-white/10 flex items-center gap-2"
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleSound();
                  }}
                >
                  {soundEnabled ? "🔊" : "🔇"} Voice chat: {soundEnabled ? "On" : "Off"}
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
        {secondsLeft !== null && (
          <span
            className={
              secondsLeft <= 5
                ? "ml-2 font-bold text-red-400"
                : "ml-2 text-white/60"
            }
          >
            {secondsLeft}s
          </span>
        )}
      </p>

      {bonusToast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-emerald-600/95 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
          {bonusToast}
        </div>
      )}

      {errorToast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600/95 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
          {errorToast}
        </div>
      )}

      {finishInfo && (
        <FinishOverlay
          info={finishInfo}
          currentUserId={currentUserId}
          onLobby={goLobby}
        />
      )}

      {showNoMovesNotification && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500/95 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
          No moves — turn skips
        </div>
      )}

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
                peerAudio={peerAudio}
                myMicOn={micOn}
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
                peerAudio={peerAudio}
                myMicOn={micOn}
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
            soundEnabled={soundEnabled}
            onLocalVideoChange={setLocalVideo}
            onMicChange={setMicOn}
            onPeersChange={handlePeersChange}
            players={
              game.players?.map((p) => ({
                id: p.id,
                userId: p.userId,
                username: p.user?.username ?? undefined,
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
