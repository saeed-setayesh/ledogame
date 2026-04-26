"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserCheck, UserX, CircleDot, Swords } from "lucide-react";

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    username: string;
    level: number;
    avatar: string | null;
  };
  createdAt: string;
}

interface Friend {
  id: string;
  username: string;
  level: number;
  avatar: string | null;
}

interface FriendRequestsProps {
  onFriendUpdate?: () => void;
}

export default function FriendRequests({
  onFriendUpdate,
}: FriendRequestsProps) {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [friendUsername, setFriendUsername] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, friendsRes] = await Promise.all([
        fetch("/api/friends/requests"),
        fetch("/api/friends/list"),
      ]);

      const requestsData = await requestsRes.json();
      const friendsData = await friendsRes.json();

      setRequests(requestsData.requests || []);
      setFriends(friendsData.friends || []);
    } catch (error) {
      console.error("Failed to fetch friends data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (friendId: string) => {
    setProcessing(friendId);
    try {
      const response = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
        onFriendUpdate?.();
      } else {
        alert(data.error || "Failed to accept friend request");
      }
    } catch (error) {
      console.error("Accept friend error:", error);
      alert("Failed to accept friend request");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string, friendId: string) => {
    setProcessing(requestId);
    try {
      // Delete the friend request
      const response = await fetch("/api/friends/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });

      const data = await response.json();
      if (data.success) {
        setRequests(requests.filter((r) => r.id !== requestId));
        onFriendUpdate?.();
      } else {
        alert(data.error || "Failed to reject friend request");
      }
    } catch (error) {
      console.error("Reject friend error:", error);
      alert("Failed to reject friend request");
    } finally {
      setProcessing(null);
    }
  };

  const handleRemove = async (friendId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;

    setProcessing(friendId);
    try {
      const response = await fetch("/api/friends/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
        onFriendUpdate?.();
      } else {
        alert(data.error || "Failed to remove friend");
      }
    } catch (error) {
      console.error("Remove friend error:", error);
      alert("Failed to remove friend");
    } finally {
      setProcessing(null);
    }
  };

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;

    setAddingFriend(true);
    try {
      const response = await fetch("/api/friends/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: friendUsername }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Friend request sent!");
        setFriendUsername("");
        fetchData();
        onFriendUpdate?.();
      } else {
        alert(data.error || "Failed to add friend");
      }
    } catch (error) {
      console.error("Add friend error:", error);
      alert("Failed to add friend");
    } finally {
      setAddingFriend(false);
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
    <div className="space-y-6">
      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Friend Requests</h3>
            <span className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-semibold">
              {requests.length}
            </span>
          </div>

          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 bg-background border border-border rounded-lg"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                      {request.sender.avatar || "👤"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {request.sender.username}
                      </div>
                      <div className="text-sm text-foreground/70">
                        Level {request.sender.level}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(request.sender.id)}
                      disabled={processing === request.sender.id}
                      className="px-4 py-2 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors flex items-center gap-2 min-h-[44px] min-w-[44px]"
                      aria-label="Accept friend request"
                    >
                      <UserCheck className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        handleReject(request.id, request.sender.id)
                      }
                      disabled={processing === request.id}
                      className="px-4 py-2 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg transition-colors flex items-center gap-2 min-h-[44px] min-w-[44px]"
                      aria-label="Reject friend request"
                    >
                      <UserX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Friend Section */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Add Friend</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
            placeholder="Enter username"
            className="flex-1 px-4 py-2 bg-background border border-border rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleAddFriend();
              }
            }}
          />
          <button
            onClick={handleAddFriend}
            disabled={addingFriend || !friendUsername.trim()}
            className="px-6 py-2 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
          >
            {addingFriend ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Friends List */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Friends</h3>
          <span className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs font-semibold">
            {friends.length}
          </span>
        </div>

        {friends.length === 0 ? (
          <div className="text-center py-8 text-foreground/70">
            <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No friends yet. Add some friends to play together!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                        {friend.avatar || "👤"}
                      </div>
                      <CircleDot className="w-3 h-3 text-success absolute -bottom-0 -right-0 bg-card rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {friend.username}
                      </div>
                      <div className="text-sm text-foreground/70">
                        Level {friend.level}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex items-center gap-2 min-h-[44px]"
                      aria-label="Challenge to game"
                    >
                      <Swords className="w-4 h-4" />
                      <span className="hidden sm:inline">Challenge</span>
                    </button>
                    <button
                      onClick={() => handleRemove(friend.id)}
                      disabled={processing === friend.id}
                      className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg transition-colors flex items-center gap-2 min-h-[44px] min-w-[44px]"
                      aria-label="Remove friend"
                    >
                      <UserX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
