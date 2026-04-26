import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Play,
  Wallet,
  User,
  Users,
  Trophy,
  Crown,
  Dices,
  Shield,
  Target,
  BarChart3,
  TrendingUp,
  HelpCircle,
  Activity,
} from "lucide-react";
import { formatUSDT } from "@/lib/utils";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      level: true,
      xp: true,
      totalGames: true,
      totalWins: true,
      walletBalance: true,
      isAdmin: true,
    },
  });

  const winRate =
    dbUser && dbUser.totalGames > 0
      ? (dbUser.totalWins / dbUser.totalGames) * 100
      : 0;

  const xpForNextLevel = (dbUser?.level || 1) * 1000;
  const xpProgress = dbUser ? (dbUser.xp % 1000) / 1000 : 0;

  const pendingRequests = await prisma.friend.count({
    where: { friendId: user.id, status: "PENDING" },
  });

  return (
    <div className="game-bg relative overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Subtle radial light behind title */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[radial-gradient(ellipse,rgba(180,40,40,0.15),transparent_70%)]" />
        {/* Gold corner ornaments */}
        <svg className="absolute top-4 left-4 w-16 h-16 opacity-20" viewBox="0 0 80 80" fill="none">
          <path d="M0 0 L80 0 L80 10 L10 10 L10 80 L0 80Z" fill="#ffd700" />
        </svg>
        <svg className="absolute top-4 right-4 w-16 h-16 opacity-20" viewBox="0 0 80 80" fill="none">
          <path d="M80 0 L0 0 L0 10 L70 10 L70 80 L80 80Z" fill="#ffd700" />
        </svg>
      </div>

      <div className="relative container mx-auto px-4 py-6 md:py-10 space-y-6 md:space-y-8 max-w-2xl">

        {/* ===== HERO ===== */}
        <div className="text-center pt-4">
          {/* Game logo / title */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <Dices className="w-8 h-8 text-gold animate-float" />
            <h1
              className="text-5xl md:text-7xl font-extrabold tracking-wider"
              style={{
                color: "#ffd700",
                textShadow: "0 0 40px rgba(255,215,0,0.3), 0 4px 20px rgba(0,0,0,0.8)",
              }}
            >
              LEDO
            </h1>
            <Dices className="w-8 h-8 text-gold animate-float" style={{ animationDelay: "1.5s" }} />
          </div>
          <p
            className="text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "rgba(255,215,0,0.5)" }}
          >
            Classic Asian Ludo
          </p>

          {/* Player badge */}
          <div className="inline-flex items-center gap-3 game-card px-5 py-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-primary-dark flex items-center justify-center text-lg">
              {user.username?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="text-left">
              <div className="font-bold text-sm" style={{ color: "#ffd700" }}>
                {user.username}
              </div>
              <div className="flex items-center gap-1 text-xs opacity-60">
                <Crown className="w-3 h-3" />
                Level {dbUser?.level || 1}
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="max-w-xs mx-auto mb-8">
            <div className="flex justify-between text-xs mb-1 opacity-50">
              <span>XP</span>
              <span>{dbUser?.xp || 0} / {xpForNextLevel}</span>
            </div>
            <div className="xp-bar">
              <div className="xp-bar-fill" style={{ width: `${Math.max(xpProgress * 100, 2)}%` }} />
            </div>
          </div>

          {/* BIG PLAY BUTTON */}
          <Link href="/lobby" className="inline-block">
            <div className="game-play-btn flex items-center gap-3 mx-auto">
              <Play className="w-7 h-7" />
              <span>PLAY NOW</span>
            </div>
          </Link>
        </div>

        {/* Gold divider */}
        <div className="game-divider" />

        {/* ===== ACTION TILES ===== */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/wallet" className="game-tile">
            <div className="game-icon-circle" style={{ background: "rgba(78,168,222,0.15)" }}>
              <Wallet className="w-6 h-6 text-info" />
            </div>
            <div className="font-bold text-sm mb-0.5">Wallet</div>
            <div className="text-xs opacity-50">
              {formatUSDT(dbUser?.walletBalance?.toString() || "0")} USDT
            </div>
          </Link>

          <Link href="/profile" className="game-tile">
            <div className="game-icon-circle" style={{ background: "rgba(255,215,0,0.10)" }}>
              <User className="w-6 h-6 text-gold-dim" />
            </div>
            <div className="font-bold text-sm mb-0.5">Profile</div>
            <div className="text-xs opacity-50">View stats</div>
          </Link>

          <Link href="/profile?tab=friends" className="game-tile relative">
            <div className="game-icon-circle" style={{ background: "rgba(60,179,113,0.12)" }}>
              <Users className="w-6 h-6 text-success" />
            </div>
            <div className="font-bold text-sm mb-0.5">Friends</div>
            <div className="text-xs opacity-50">
              {pendingRequests > 0 ? `${pendingRequests} new` : "Manage"}
            </div>
            {pendingRequests > 0 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-xs font-bold text-white">
                {pendingRequests}
              </span>
            )}
          </Link>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="grid grid-cols-3 gap-3">
          <div className="game-card text-center py-4">
            <div className="text-2xl font-extrabold" style={{ color: "#ffd700" }}>
              {dbUser?.totalGames || 0}
            </div>
            <div className="text-xs opacity-50 mt-1">Games</div>
          </div>
          <div className="game-card text-center py-4">
            <div className="text-2xl font-extrabold text-success">
              {dbUser?.totalWins || 0}
            </div>
            <div className="text-xs opacity-50 mt-1">Wins</div>
          </div>
          <div className="game-card text-center py-4">
            <div className="text-2xl font-extrabold" style={{ color: "#d4382c" }}>
              {winRate.toFixed(0)}%
            </div>
            <div className="text-xs opacity-50 mt-1">Win Rate</div>
          </div>
        </div>

        {/* Gold divider */}
        <div className="game-divider" />

        {/* ===== HOW TO PLAY ===== */}
        <div className="game-card">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5" style={{ color: "#ffd700" }} />
            <h3 className="text-base font-bold" style={{ color: "#ffd700" }}>How to Play</h3>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { n: "1", title: "Create or Join", desc: "Start a new game or join from the lobby" },
              { n: "2", title: "Play & Win", desc: "Roll the dice, move pieces, be the first to finish" },
              { n: "3", title: "Earn Rewards", desc: "Win USDT prizes and climb the leaderboard" },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "rgba(212,56,44,0.25)", color: "#ffd700" }}>
                  {step.n}
                </div>
                <div>
                  <div className="font-bold mb-0.5">{step.title}</div>
                  <div className="opacity-50 text-xs">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin link */}
        {dbUser?.isAdmin && (
          <Link href="/admin" className="game-tile flex items-center gap-3">
            <div className="game-icon-circle" style={{ background: "rgba(220,53,69,0.15)", width: 40, height: 40 }}>
              <Shield className="w-5 h-5 text-danger" />
            </div>
            <div>
              <div className="font-bold text-sm">Admin Dashboard</div>
              <div className="text-xs opacity-50">Manage users & games</div>
            </div>
          </Link>
        )}

        {/* Bottom spacer for mobile */}
        <div className="h-8" />
      </div>
    </div>
  );
}
