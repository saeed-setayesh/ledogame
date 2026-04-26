"use client";

import { useState, useEffect } from "react";
import { Crown, ArrowUp, ArrowDown, Users, Trophy } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  username: string;
  wins: number;
  games: number;
  level: number;
  winRate: number;
}

interface LeaderboardCardProps {
  currentUserId?: string;
}

export default function LeaderboardCard({
  currentUserId,
}: LeaderboardCardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/profile/leaderboard?limit=10");
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setUserRank(data.userRank || null);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
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
        <Crown className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Leaderboard</h3>
      </div>

      {userRank !== null && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground/70 mb-1">Your Rank</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  #{userRank}
                </span>
                {userRank <= 3 && <Crown className="w-6 h-6 text-accent" />}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-foreground/70">Top Players</p>
              <p className="text-lg font-semibold">{leaderboard.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-foreground/70">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No leaderboard data yet</p>
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <div
              key={entry.rank}
              className={`p-3 rounded-lg border ${
                index < 3
                  ? "bg-gradient-to-r from-accent/10 to-primary/10 border-accent/30"
                  : "bg-background border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 text-center">
                    {index === 0 ? (
                      <Crown className="w-6 h-6 text-accent mx-auto" />
                    ) : (
                      <span className="font-bold text-foreground/70">
                        #{entry.rank}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {entry.username}
                    </div>
                    <div className="text-xs text-foreground/70">
                      Level {entry.level} • {entry.wins} wins •{" "}
                      {entry.winRate.toFixed(1)}% win rate
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span className="font-semibold">{entry.wins}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
