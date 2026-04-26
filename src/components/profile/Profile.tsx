"use client";

import { useState } from "react";
import { formatUSDT } from "@/lib/utils";
import {
  Trophy,
  Target,
  TrendingUp,
  Flame,
  Wallet,
  Gamepad2,
  User,
  BarChart3,
  ArrowRightLeft,
  Crown,
  Coins,
  ArrowLeft,
} from "lucide-react";
import RecentGames from "./RecentGames";
import Achievements from "./Achievements";
import AvatarSelector from "./AvatarSelector";
import LeaderboardCard from "./LeaderboardCard";
import FriendRequests from "./FriendRequests";
import Link from "next/link";

interface User {
  id: string;
  username: string;
  email: string;
  level: number;
  xp: number;
  totalGames: number;
  totalWins: number;
  walletBalance: any;
  createdAt: Date;
  avatar?: string | null;
}

interface ProfileProps {
  user: User;
}

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "games", label: "Games" },
  { key: "friends", label: "Friends" },
  { key: "customize", label: "Customize" },
] as const;

export default function ProfileComponent({ user }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "games" | "friends" | "customize"
  >("overview");

  const xpForNextLevel = user.level * 1000;
  const xpProgress = (user.xp % 1000) / 1000;
  const winRate =
    user.totalGames > 0 ? (user.totalWins / user.totalGames) * 100 : 0;
  const totalEarnings = user.totalWins * 10;
  const currentStreak = 3;

  return (
    <div className="game-bg relative overflow-hidden">
      {/* Background accent */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(180,40,40,0.12),transparent_70%)]" />

      <div className="relative container mx-auto px-4 py-6 max-w-2xl space-y-5">

        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-80 transition-opacity" style={{ minHeight: "auto" }}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* ===== PROFILE HEADER ===== */}
        <div className="game-card p-5 flex items-center gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl md:text-4xl shrink-0"
            style={{
              background: "linear-gradient(180deg, #d4382c, #8b1a1a)",
              border: "3px solid rgba(255,215,0,0.4)",
              boxShadow: "0 0 20px rgba(212,56,44,0.3)",
            }}
          >
            {user.avatar || "👤"}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl md:text-2xl font-extrabold tracking-wide truncate"
              style={{ color: "#ffd700", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
            >
              {user.username}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="gold-badge flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Level {user.level}
              </span>
              <span className="gold-badge flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                {user.totalWins} Wins
              </span>
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all"
              style={
                activeTab === tab.key
                  ? {
                      background: "linear-gradient(180deg, #d4382c, #8b1a1a)",
                      color: "#ffd700",
                      border: "1px solid rgba(255,215,0,0.3)",
                      boxShadow: "0 0 15px rgba(212,56,44,0.3)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,240,214,0.4)",
                      border: "1px solid rgba(255,215,0,0.06)",
                    }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== TAB CONTENT ===== */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="game-card text-center py-4">
                <Coins className="w-5 h-5 mx-auto mb-1" style={{ color: "#ffd700" }} />
                <div className="text-xl font-extrabold" style={{ color: "#ffd700" }}>
                  {formatUSDT(user.walletBalance.toString())}
                </div>
                <div className="text-xs opacity-40 mt-0.5">USDT Balance</div>
              </div>
              <div className="game-card text-center py-4">
                <Gamepad2 className="w-5 h-5 mx-auto mb-1 text-info" />
                <div className="text-xl font-extrabold text-info">
                  {user.totalGames}
                </div>
                <div className="text-xs opacity-40 mt-0.5">Games Played</div>
              </div>
              <div className="game-card text-center py-4">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-success" />
                <div className="text-xl font-extrabold text-success">
                  {user.totalWins}
                </div>
                <div className="text-xs opacity-40 mt-0.5">{winRate.toFixed(1)}% win rate</div>
              </div>
              <div className="game-card text-center py-4">
                <Flame className="w-5 h-5 mx-auto mb-1 text-danger" />
                <div className="text-xl font-extrabold text-danger">
                  {currentStreak}
                </div>
                <div className="text-xs opacity-40 mt-0.5">Win Streak</div>
              </div>
            </div>

            {/* XP Progress */}
            <div className="game-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: "#ffd700" }} />
                  <span className="text-sm font-bold" style={{ color: "#ffd700" }}>Level Progress</span>
                </div>
                <span className="text-xs opacity-40">
                  {user.xp} / {xpForNextLevel} XP
                </span>
              </div>
              <div className="xp-bar">
                <div
                  className="xp-bar-fill"
                  style={{ width: `${Math.max(xpProgress * 100, 2)}%` }}
                />
              </div>
            </div>

            {/* Achievements Preview */}
            <Achievements />

            {/* Leaderboard */}
            <LeaderboardCard currentUserId={user.id} />
          </div>
        )}

        {activeTab === "games" && (
          <div className="space-y-4">
            <RecentGames />
          </div>
        )}

        {activeTab === "friends" && (
          <div className="space-y-4">
            <FriendRequests />
          </div>
        )}

        {activeTab === "customize" && (
          <div className="space-y-4">
            <AvatarSelector
              currentAvatar={user.avatar}
              onAvatarChange={() => {
                window.location.reload();
              }}
            />
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
