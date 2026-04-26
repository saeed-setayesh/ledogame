"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DiceProps {
  value: number | null;
  onRoll?: () => void;
  disabled?: boolean;
  rolling?: boolean;
  variant?: "lacquer" | "white";
}

export default function Dice({ value, onRoll, disabled, rolling, variant = "lacquer" }: DiceProps) {
  const [displayValue, setDisplayValue] = useState(value || 1);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (rolling) {
      setIsRolling(true);
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setIsRolling(false);
        if (value) {
          setDisplayValue(value);
        }
      }, 1000);
    } else if (value) {
      setDisplayValue(value);
    }
  }, [value, rolling]);

  const dots = Array.from({ length: displayValue }, (_, i) => i);

  return (
    <div className="relative">
      <button
        onClick={onRoll}
        disabled={disabled || isRolling}
        className={cn(
          "w-20 h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl",
          variant === "white" ? "bg-white shadow-lg border-2 border-gray-200" : "dice-lacquer",
          "flex items-center justify-center",
          "transition-all duration-300",
          "hover:scale-110 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !disabled && !isRolling && "animate-pulse",
          isRolling && "animate-spin"
        )}
      >
        <div className="grid grid-cols-3 gap-1 md:gap-1.5 p-2 md:p-3">
          {dots.map((dot, i) => (
            <div
              key={i}
              className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full"
              style={{
                background: variant === "white" ? "#333" : "#ffd166",
                boxShadow: variant === "white" ? "0 1px 2px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.4)",
                gridColumn: getDotPosition(displayValue, i).col,
                gridRow: getDotPosition(displayValue, i).row,
              }}
            />
          ))}
        </div>
      </button>
      {isRolling && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl md:rounded-2xl">
          <div className="text-xs md:text-sm font-bold text-gray-800 animate-pulse">
            Rolling...
          </div>
        </div>
      )}
    </div>
  );
}

function getDotPosition(
  value: number,
  index: number
): { col: number; row: number } {
  const positions: Record<number, { col: number; row: number }[]> = {
    1: [{ col: 2, row: 2 }],
    2: [
      { col: 1, row: 1 },
      { col: 3, row: 3 },
    ],
    3: [
      { col: 1, row: 1 },
      { col: 2, row: 2 },
      { col: 3, row: 3 },
    ],
    4: [
      { col: 1, row: 1 },
      { col: 3, row: 1 },
      { col: 1, row: 3 },
      { col: 3, row: 3 },
    ],
    5: [
      { col: 1, row: 1 },
      { col: 3, row: 1 },
      { col: 2, row: 2 },
      { col: 1, row: 3 },
      { col: 3, row: 3 },
    ],
    6: [
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
      { col: 3, row: 1 },
      { col: 3, row: 2 },
      { col: 3, row: 3 },
    ],
  };

  return positions[value]?.[index] || { col: 2, row: 2 };
}
