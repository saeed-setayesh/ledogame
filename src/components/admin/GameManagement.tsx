"use client";

import { useState, useEffect } from "react";
import {
  Gamepad2,
  Filter,
  Users,
  Coins,
  Trophy,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Crown,
} from "lucide-react";
import { formatUSDT } from "@/lib/utils";
import Link from "next/link";

interface Game {
  id: string;
  roomId: string;
  gameType: string;
  status: string;
  entryFee: string;
  totalPot: string;
  commissionAmount: string;
  creator: {
    id: string;
    username: string;
  };
  winner: {
    id: string;
    username: string;
  } | null;
  players: Array<{
    id: string;
    username: string;
    isWinner: boolean;
    payoutAmount: string;
  }>;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export default function GameManagement() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchGames();
  }, [page, statusFilter]);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "20");
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/admin/games?${params.toString()}`);
      const data = await response.json();
      setGames(data.games || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Failed to fetch games:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "FINISHED":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "ACTIVE":
        return <Clock className="w-4 h-4 text-info" />;
      case "WAITING":
        return <AlertCircle className="w-4 h-4 text-accent" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-danger" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FINISHED":
        return "text-success border-success/30 bg-success/10";
      case "ACTIVE":
        return "text-info border-info/30 bg-info/10";
      case "WAITING":
        return "text-accent border-accent/30 bg-accent/10";
      case "CANCELLED":
        return "text-danger border-danger/30 bg-danger/10";
      default:
        return "text-foreground/70 border-border bg-background";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading && games.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Game Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground/70" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm min-h-[44px]"
          >
            <option value="all">All Status</option>
            <option value="WAITING">Waiting</option>
            <option value="ACTIVE">Active</option>
            <option value="FINISHED">Finished</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Games List */}
      <div className="space-y-3">
        {games.length === 0 ? (
          <div className="text-center py-12 text-foreground/70">
            <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No games found</p>
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-foreground/50">
                          #{game.roomId.slice(0, 8)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 ${getStatusColor(
                            game.status
                          )}`}
                        >
                          {getStatusIcon(game.status)}
                          {game.status}
                        </span>
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold">
                          {game.gameType}
                        </span>
                      </div>
                      <div className="text-sm text-foreground/70">
                        Created by:{" "}
                        <span className="font-semibold">
                          {game.creator.username}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/game/${game.id}`}
                      className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex items-center gap-2 min-h-[44px] flex-shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-foreground/50 mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        Entry Fee
                      </div>
                      <div className="font-semibold text-primary">
                        {formatUSDT(game.entryFee)} USDT
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50 mb-1 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Total Pot
                      </div>
                      <div className="font-semibold text-success">
                        {formatUSDT(game.totalPot)} USDT
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50 mb-1 flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Commission
                      </div>
                      <div className="font-semibold text-accent">
                        {formatUSDT(game.commissionAmount)} USDT
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-foreground/50 mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Players
                      </div>
                      <div className="font-semibold">{game.players.length}</div>
                    </div>
                  </div>

                  {/* Players */}
                  {game.players.length > 0 && (
                    <div>
                      <div className="text-xs text-foreground/50 mb-2">
                        Players:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {game.players.map((player) => (
                          <div
                            key={player.id}
                            className={`px-2 py-1 rounded-lg text-xs ${
                              player.isWinner
                                ? "bg-success/20 text-success border border-success/30"
                                : "bg-background border border-border text-foreground/70"
                            }`}
                          >
                            {player.username}
                            {player.isWinner && (
                              <Trophy className="w-3 h-3 inline ml-1" />
                            )}
                            {parseFloat(player.payoutAmount) > 0 && (
                              <span className="ml-1">
                                (+{formatUSDT(player.payoutAmount)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Winner */}
                  {game.winner && (
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy className="w-4 h-4 text-accent" />
                      <span className="text-foreground/70">Winner:</span>
                      <span className="font-semibold text-accent">
                        {game.winner.username}
                      </span>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex flex-wrap gap-4 text-xs text-foreground/50">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: {formatDate(game.createdAt)}
                    </div>
                    {game.startedAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started: {formatDate(game.startedAt)}
                      </div>
                    )}
                    {game.finishedAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Finished: {formatDate(game.finishedAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-background border border-border rounded-lg hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <span className="text-sm text-foreground/70">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-background border border-border rounded-lg hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
