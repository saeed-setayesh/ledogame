"use client";

import { useState, useEffect } from "react";
import { Gamepad2, Calendar, DollarSign, Trophy, X, Users } from "lucide-react";
import { formatUSDT } from "@/lib/utils";
import Link from "next/link";

interface RecentGame {
  id: string;
  roomId: string;
  gameType: string;
  entryFee: string;
  totalPot: string;
  result: "win" | "loss";
  payoutAmount: string;
  finishedAt: string | null;
  winner: {
    id: string;
    username: string;
  } | null;
  players: Array<{
    id: string;
    username: string;
    color: string;
    isWinner: boolean;
  }>;
}

export default function RecentGames() {
  const [games, setGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch("/api/profile/recent-games?limit=10");
      const data = await response.json();
      setGames(data.games || []);
    } catch (error) {
      console.error("Failed to fetch recent games:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Gamepad2 className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Recent Games</h3>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-8 text-foreground/70">
          <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No games played yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="block p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {game.result === "win" ? (
                      <Trophy className="w-5 h-5 text-success" />
                    ) : (
                      <X className="w-5 h-5 text-danger" />
                    )}
                    <span
                      className={`font-semibold ${
                        game.result === "win" ? "text-success" : "text-danger"
                      }`}
                    >
                      {game.result === "win" ? "Victory" : "Defeat"}
                    </span>
                    <span className="text-sm text-foreground/70">
                      {game.gameType === "SOLO" ? "Solo" : "Team"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-foreground/70 mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(game.finishedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Entry: {formatUSDT(game.entryFee)}
                    </div>
                  </div>
                  {game.winner && (
                    <p className="text-xs text-foreground/50">
                      Winner: {game.winner.username}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {game.result === "win" ? "+" : "-"}
                    {formatUSDT(game.payoutAmount)} USDT
                  </div>
                  <div className="text-xs text-foreground/50 mt-1">
                    Pot: {formatUSDT(game.totalPot)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
