"use client";

import { useState } from "react";
import { LudoGameState, PlayerColor } from "@/lib/game/ludo-engine";
import { cn } from "@/lib/utils";

interface TurnNotificationBarProps {
  gameState: LudoGameState;
  currentUserId: string;
  availableMoves: number[];
  onRollDice?: () => void;
  isPracticeMode: boolean;
}

export default function TurnNotificationBar({
  gameState,
  currentUserId,
  availableMoves,
  onRollDice,
  isPracticeMode,
}: TurnNotificationBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const playerIndex = gameState.players.findIndex(
    (p) => p.userId === currentUserId
  );
  const currentPlayer =
    playerIndex !== -1 ? gameState.players[playerIndex] : null;
  const currentTurnPlayer = gameState.players[gameState.currentTurn];
  const isMyTurn = playerIndex !== -1 && gameState.currentTurn === playerIndex;

  const getColorName = (color: PlayerColor): string => {
    const colors: Record<PlayerColor, string> = {
      RED: "Red",
      BLUE: "Blue",
      GREEN: "Green",
      YELLOW: "Yellow",
    };
    return colors[color] || color;
  };

  const getTurnMessage = () => {
    if (isMyTurn) {
      if (currentPlayer?.hasRolled) {
        if (availableMoves.length === 0) {
          return "Select a piece to move";
        }
        return "Select a piece to move";
      }
      return "Your Turn - Roll the dice";
    } else {
      if (currentTurnPlayer?.userId?.startsWith("AI_")) {
        return `🤖 ${getColorName(currentTurnPlayer.color)}'s Turn (AI)`;
      }
      return `${getColorName(currentTurnPlayer.color)}'s Turn`;
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-300",
        isCollapsed ? "translate-y-full" : "translate-y-0"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Turn info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isPracticeMode && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full border border-blue-300 dark:border-blue-700">
                  🎮 Practice
                </span>
              )}
              <p
                className={cn(
                  "text-sm font-semibold truncate",
                  isMyTurn
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-700 dark:text-gray-300"
                )}
              >
                {getTurnMessage()}
              </p>
            </div>
            {gameState.diceValue !== null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dice: {gameState.diceValue}
              </p>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {isMyTurn && !currentPlayer?.hasRolled && onRollDice && (
              <button
                onClick={onRollDice}
                className="px-4 py-2.5 md:py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg min-w-[100px] touch-manipulation"
              >
                Roll Dice
              </button>
            )}
            {isMyTurn &&
              currentPlayer?.hasRolled &&
              availableMoves.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {availableMoves.length} move
                  {availableMoves.length > 1 ? "s" : ""} available
                </p>
              )}

            {/* Collapse button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              <svg
                className={cn(
                  "w-5 h-5 transition-transform",
                  isCollapsed ? "rotate-180" : ""
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
