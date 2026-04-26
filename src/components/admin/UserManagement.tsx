"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Crown,
  Mail,
  Gamepad2,
  Trophy,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatUSDT } from "@/lib/utils";

interface User {
  id: string;
  username: string;
  email: string;
  level: number;
  totalGames: number;
  totalWins: number;
  walletBalance: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "20");
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    setProcessing(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isAdmin: !currentStatus,
        }),
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Toggle admin error:", error);
      alert("Failed to update user");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading && users.length === 0) {
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
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">User Management</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by username or email..."
          className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="text-center py-12 text-foreground/70">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">
                          {user.username}
                        </span>
                        {user.isAdmin && (
                          <Crown className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <div className="text-foreground/50">Level</div>
                      <div className="font-semibold">{user.level}</div>
                    </div>
                    <div>
                      <div className="text-foreground/50 flex items-center gap-1">
                        <Gamepad2 className="w-3 h-3" />
                        Games
                      </div>
                      <div className="font-semibold">{user.totalGames}</div>
                    </div>
                    <div>
                      <div className="text-foreground/50 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Wins
                      </div>
                      <div className="font-semibold text-success">
                        {user.totalWins}
                      </div>
                    </div>
                    <div>
                      <div className="text-foreground/50 flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        Balance
                      </div>
                      <div className="font-semibold text-primary">
                        {formatUSDT(user.walletBalance)} USDT
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-foreground/50 mt-2">
                    Joined: {formatDate(user.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                    disabled={processing === user.id}
                    className={`px-4 py-2 rounded-lg font-semibold transition-opacity flex items-center gap-2 min-h-[44px] ${
                      user.isAdmin
                        ? "bg-accent/20 hover:bg-accent/30 text-accent"
                        : "bg-primary/20 hover:bg-primary/30 text-primary"
                    } disabled:opacity-50`}
                  >
                    {user.isAdmin ? (
                      <>
                        <UserX className="w-4 h-4" />
                        <span className="hidden sm:inline">Remove Admin</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Make Admin</span>
                      </>
                    )}
                  </button>
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
