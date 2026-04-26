"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket/client";

interface PracticeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function PracticeModeModal({
  isOpen,
  onClose,
  userId,
}: PracticeModeModalProps) {
  const router = useRouter();
  const [aiPlayers, setAiPlayers] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartPractice = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "SOLO",
          maxPlayers: 1 + aiPlayers,
          entryFee: 0,
          aiPlayers,
          practiceMode: true,
          gameMode: "CLASSIC",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create practice game");
        setLoading(false);
        return;
      }

      if (!data.game?.id) {
        setError("Invalid response from server");
        setLoading(false);
        return;
      }

      // Wait for socket to be connected before navigating (so game:join works)
      const socket = getSocket();
      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("connect");
            reject(new Error("Connection timeout. Please check your network."));
          }, 8000);
          socket.once("connect", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      onClose();
      router.push(`/game/${data.game.id}`);
    } catch (err: any) {
      console.error("Failed to create practice game:", err);
      setError(err.message || "Failed to create practice game. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="game-card p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: "#ffd700" }}>
            Practice Mode
          </h2>
          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-80 transition-opacity"
            style={{ minHeight: "auto" }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(220,53,69,0.15)",
                border: "1px solid rgba(220,53,69,0.3)",
                color: "#ff6b6b",
              }}
            >
              {error}
            </div>
          )}

          <p className="text-sm opacity-70">
            Play against AI opponents to practice. No entry fee required!
          </p>

          <div>
            <label className="block text-sm font-medium mb-3">
              Number of AI Players: {aiPlayers}
            </label>
            <input
              type="range"
              min="1"
              max="3"
              value={aiPlayers}
              onChange={(e) => setAiPlayers(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs opacity-50 mt-1">
              <span>1 AI</span>
              <span>3 AI</span>
            </div>
            <p className="text-xs opacity-50 mt-2">
              Total: {1 + aiPlayers} players (you + {aiPlayers} AI)
            </p>
          </div>

          <button
            onClick={handleStartPractice}
            disabled={loading}
            className="game-play-btn w-full text-center justify-center"
          >
            {loading ? "Creating..." : "Start Practice Game"}
          </button>
        </div>
      </div>
    </div>
  );
}
