"use client";

import { useState, useEffect } from "react";
import { formatUSDT } from "@/lib/utils";
import {
  BarChart3,
  Users,
  Gamepad2,
  Coins,
  Settings,
  DollarSign,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserX,
  Crown,
  Shield,
} from "lucide-react";
import UserManagement from "./UserManagement";
import GameManagement from "./GameManagement";

interface Stats {
  totalGames: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalCommission: number;
  activeUsers: number;
}

interface GameSettings {
  defaultEntryFee: number;
  minEntryFee: number;
  maxEntryFee: number;
  commissionRate: number;
  allowedEntryFees: number[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "settings" | "users" | "games"
  >("overview");
  const [saving, setSaving] = useState(false);

  // Settings form state
  const [formSettings, setFormSettings] = useState<GameSettings | null>(null);

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();
      setSettings(data.settings);
      setFormSettings(data.settings);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    if (!formSettings) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formSettings),
      });

      const data = await response.json();
      if (data.success) {
        alert("Settings saved successfully!");
        setSettings(formSettings);
        fetchStats();
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Save settings error:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="game-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="game-bg p-4">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">
          Admin Dashboard
        </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap min-h-[44px] transition-colors ${
              activeTab === "overview"
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap min-h-[44px] transition-colors ${
              activeTab === "settings"
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </div>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap min-h-[44px] transition-colors ${
              activeTab === "users"
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </div>
          </button>
          <button
            onClick={() => setActiveTab("games")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap min-h-[44px] transition-colors ${
              activeTab === "games"
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              Games
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && stats && (
          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Gamepad2 className="w-5 h-5 text-primary" />
                  <div className="text-sm text-foreground/70">Total Games</div>
                </div>
              <div className="text-3xl font-bold">{stats.totalGames}</div>
                <div className="text-xs text-foreground/50 mt-1">Today</div>
            </div>

              <div className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <div className="text-sm text-foreground/70">
                    Total Deposits
                  </div>
                </div>
              <div className="text-3xl font-bold text-success">
                {formatUSDT(stats.totalDeposits)} USDT
                </div>
                <div className="text-xs text-foreground/50 mt-1">Today</div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-danger" />
                  <div className="text-sm text-foreground/70">
                    Total Withdrawals
              </div>
            </div>
              <div className="text-3xl font-bold text-danger">
                {formatUSDT(stats.totalWithdrawals)} USDT
                </div>
                <div className="text-xs text-foreground/50 mt-1">Today</div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-accent" />
                  <div className="text-sm text-foreground/70">
                    Total Commission
              </div>
            </div>
              <div className="text-3xl font-bold text-primary">
                {formatUSDT(stats.totalCommission)} USDT
              </div>
                <div className="text-xs text-foreground/50 mt-1">Today</div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 md:p-6 hover:border-primary transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-info" />
                  <div className="text-sm text-foreground/70">Active Users</div>
                </div>
                <div className="text-3xl font-bold">{stats.activeUsers}</div>
                <div className="text-xs text-foreground/50 mt-1">Today</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && formSettings && (
          <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Game Settings</h2>
            </div>

            <div className="space-y-6">
              {/* Entry Fee Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Entry Fee Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Default Entry Fee (USDT)
                    </label>
                    <input
                      type="number"
                      value={formSettings.defaultEntryFee}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          defaultEntryFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Minimum Entry Fee (USDT)
                    </label>
                    <input
                      type="number"
                      value={formSettings.minEntryFee}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          minEntryFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Maximum Entry Fee (USDT)
                    </label>
                    <input
                      type="number"
                      value={formSettings.maxEntryFee}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          maxEntryFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="0.1"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Allowed Entry Fees (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formSettings.allowedEntryFees.join(", ")}
                    onChange={(e) => {
                      const values = e.target.value
                        .split(",")
                        .map((v) => parseFloat(v.trim()))
                        .filter((v) => !isNaN(v));
                      setFormSettings({
                        ...formSettings,
                        allowedEntryFees: values,
                      });
                    }}
                    placeholder="1, 2, 3, 5, 10"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
                  />
                  <p className="text-xs text-foreground/50 mt-1">
                    These are the quick-select options shown in the lobby
                  </p>
                </div>
              </div>

              {/* Commission Settings */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  Commission Settings
                </h3>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formSettings.commissionRate}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
                  />
                  <p className="text-xs text-foreground/50 mt-1">
                    Percentage of entry fees taken as commission (0-100)
                  </p>
                </div>
            </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "users" && <UserManagement />}

        {activeTab === "games" && <GameManagement />}
      </div>
    </div>
  );
}
