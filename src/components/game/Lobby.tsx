"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import PracticeModeModal from "./PracticeModeModal";
import {
  Gamepad2,
  User,
  Users,
  Coins,
  Bot,
  Play,
  Settings,
  Dices,
  Trophy,
  Sparkles,
} from "lucide-react";

interface LobbyProps {
  userId: string;
}

export default function Lobby({ userId }: LobbyProps) {
  const router = useRouter();
  const [gameMode, setGameMode] = useState<"CLASSIC" | "RUSH">("CLASSIC");
  const [gameType, setGameType] = useState<"SOLO" | "TEAM">("SOLO");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [playersPerTeam, setPlayersPerTeam] = useState(2);
  const [entryFee, setEntryFee] = useState(1);
  const [aiPlayers, setAiPlayers] = useState(0);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entryFees, setEntryFees] = useState([1, 2, 3, 5, 10]);

  // Fetch allowed entry fees from admin settings
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.allowedEntryFees) {
          setEntryFees(data.settings.allowedEntryFees);
          // Set default to first allowed fee or admin's default
          if (data.settings.defaultEntryFee) {
            setEntryFee(data.settings.defaultEntryFee);
          } else if (data.settings.allowedEntryFees.length > 0) {
            setEntryFee(data.settings.allowedEntryFees[0]);
          }
        }
      })
      .catch(() => {
        // Use defaults if fetch fails
      });
  }, []);

  const handleCreateGame = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType,
          gameMode,
          maxPlayers,
          playersPerTeam: gameType === "TEAM" ? playersPerTeam : null,
          entryFee,
          aiPlayers,
          practiceMode: false,
        }),
      });

      const data = await response.json();
      if (data.game) {
        router.push(`/game/${data.game.id}`);
      }
    } catch (error) {
      console.error("Failed to create game:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game-bg p-4">
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="text-center mb-4 md:mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Dices className="w-8 h-8 md:w-10 md:h-10 animate-float" style={{ color: "#ffd700" }} />
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-wider" style={{ color: "#ffd700", textShadow: "0 0 30px rgba(255,215,0,0.25)" }}>
              Create Game
            </h1>
            <Dices className="w-8 h-8 md:w-10 md:h-10 animate-float" style={{ color: "#ffd700", animationDelay: "1.5s" }} />
          </div>
          <p className="text-sm md:text-base opacity-50">
            Set up your game and invite friends to play
          </p>
          <div className="game-divider mt-4" />
        </div>

        {/* Game Mode: Classic vs Rush */}
        <div className="game-card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5" style={{ color: "#ffd700" }} />
            <label className="block text-lg font-semibold" style={{ color: "#ffd700" }}>Game Mode</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGameMode("CLASSIC")}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left",
                gameMode === "CLASSIC"
                  ? "border-primary shadow-lg"
                  : "border-transparent hover:border-primary/50"
              )}
              style={
                gameMode === "CLASSIC"
                  ? { background: "linear-gradient(180deg, rgba(212,56,44,0.25), rgba(212,56,44,0.1))", borderColor: "#d4382c" }
                  : { background: "rgba(255,255,255,0.03)" }
              }
            >
              <div className="font-bold mb-1">Classic</div>
              <div className="text-xs opacity-60">Turn-based. Roll, move, wait for others.</div>
            </button>
            <button
              onClick={() => setGameMode("RUSH")}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left",
                gameMode === "RUSH"
                  ? "border-primary shadow-lg"
                  : "border-transparent hover:border-primary/50"
              )}
              style={
                gameMode === "RUSH"
                  ? { background: "linear-gradient(180deg, rgba(212,56,44,0.25), rgba(212,56,44,0.1))", borderColor: "#d4382c" }
                  : { background: "rgba(255,255,255,0.03)" }
              }
            >
              <div className="font-bold mb-1">Rush</div>
              <div className="text-xs opacity-60">Your own dice. Roll & move fast. No waiting!</div>
            </button>
          </div>
        </div>

          {/* Practice Mode Button */}
        <div className="game-card">
            <button
              onClick={() => setShowPracticeModal(true)}
            className="w-full py-4 bg-gradient-to-r from-success/20 to-success/10 border-2 border-success/30 rounded-lg font-semibold text-white hover:border-success hover:scale-[1.02] transition-all shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6 text-success group-hover:rotate-180 transition-transform" />
              <span className="text-lg">Practice Mode (Play with AI)</span>
              <Bot className="w-6 h-6 text-success" />
            </div>
            </button>
          <p className="text-xs text-foreground/60 mt-3 text-center">
            Free practice games against AI opponents - No entry fee required
            </p>
          </div>

        {/* Main Game Creation Form */}
        <div className="game-card space-y-6">
            {/* Game Type */}
            <div>
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <label className="block text-lg font-semibold">Game Type</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <button
                  onClick={() => setGameType("SOLO")}
                  className={cn(
                  "p-4 md:p-6 rounded-xl border-2 transition-all text-left group relative overflow-hidden min-h-[44px]",
                    gameType === "SOLO"
                    ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg scale-105"
                    : "border-border hover:border-primary/50 bg-background"
                  )}
                >
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
                <div className="relative flex items-center gap-3 mb-2">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      gameType === "SOLO" ? "bg-primary/20" : "bg-background"
                    )}
                  >
                    <User
                      className={cn(
                        "w-6 h-6",
                        gameType === "SOLO"
                          ? "text-primary"
                          : "text-foreground/70"
                      )}
                    />
                  </div>
                  <div className="font-bold text-lg">Solo</div>
                </div>
                <div className="text-sm text-foreground/70">1-player teams</div>
                </button>
                <button
                  onClick={() => setGameType("TEAM")}
                  className={cn(
                  "p-4 md:p-6 rounded-xl border-2 transition-all text-left group relative overflow-hidden min-h-[44px]",
                    gameType === "TEAM"
                    ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg scale-105"
                    : "border-border hover:border-primary/50 bg-background"
                  )}
                >
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
                <div className="relative flex items-center gap-3 mb-2">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      gameType === "TEAM" ? "bg-primary/20" : "bg-background"
                    )}
                  >
                    <Users
                      className={cn(
                        "w-6 h-6",
                        gameType === "TEAM"
                          ? "text-primary"
                          : "text-foreground/70"
                      )}
                    />
                  </div>
                  <div className="font-bold text-lg">Team</div>
                </div>
                  <div className="text-sm text-foreground/70">
                    Multi-player teams
                  </div>
                </button>
              </div>
            </div>

            {/* Max Players */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Max Players: {maxPlayers}
              </label>
              <input
                type="range"
                min="2"
                max="12"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-foreground/70 mt-1">
                <span>2</span>
                <span>12</span>
              </div>
            </div>

            {/* Players Per Team (for team games) */}
            {gameType === "TEAM" && (
              <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <label className="block text-lg font-semibold">
                    Players Per Team
                </label>
                </div>
                <div className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-lg">
                  <span className="text-xl font-bold text-primary">
                    {playersPerTeam}
                  </span>
                </div>
              </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(parseInt(e.target.value))}
                className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                />
              <div className="flex justify-between text-xs text-foreground/70 mt-2">
                <span>1</span>
                <span>6</span>
              </div>
              </div>
            )}

            {/* Entry Fee */}
            <div>
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-primary" />
              <label className="block text-lg font-semibold">
                Entry Fee (USDT)
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
                {entryFees.map((fee) => (
                  <button
                    key={fee}
                    onClick={() => setEntryFee(fee)}
                    className={cn(
                    "p-3 md:p-4 rounded-lg border-2 font-bold text-lg transition-all relative overflow-hidden min-h-[44px]",
                      entryFee === fee
                      ? "border-primary bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg scale-105"
                      : "border-border hover:border-primary/50 bg-background"
                    )}
                  >
                  {entryFee === fee && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
                  )}
                  <div className="relative flex items-center justify-center gap-1">
                    {entryFee === fee && <Coins className="w-4 h-4" />}
                    <span>{fee}</span>
                  </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Players */}
            <div>
              <label className="block text-sm font-medium mb-3">
                AI Players: {aiPlayers}
              </label>
              <input
                type="range"
                min="0"
                max={Math.max(0, maxPlayers - 1)}
                value={aiPlayers}
                onChange={(e) => setAiPlayers(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-foreground/70 mt-1">
                <span>0 (Human Only)</span>
                <span>{Math.max(0, maxPlayers - 1)}</span>
              </div>
              {aiPlayers > 0 ? (
                <p className="text-xs text-foreground/60 mt-2">
                  ✓ Game will start automatically with {aiPlayers + 1} total
                  player{aiPlayers + 1 > 1 ? "s" : ""} ({aiPlayers} AI)
                </p>
              ) : (
                <p className="text-xs text-foreground/60 mt-2">
                  Game will start when {maxPlayers} players join
                </p>
              )}
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateGame}
              disabled={loading}
            className="w-full py-4 md:py-5 bg-gradient-to-r from-primary via-secondary to-accent rounded-xl font-bold text-white hover:opacity-90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg border-2 border-primary/30 relative overflow-hidden group min-h-[44px]"
            >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors"></div>
            <div className="relative flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating Game...</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  <span className="text-lg">Create Game</span>
                  <Trophy className="w-6 h-6" />
                </>
              )}
            </div>
            </button>
        </div>
      </div>

      <PracticeModeModal
        isOpen={showPracticeModal}
        onClose={() => setShowPracticeModal(false)}
        userId={userId}
      />
    </div>
  );
}
