"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DiceProps {
  value: number | null;
  onRoll?: () => void;
  disabled?: boolean;
  rolling?: boolean;
  variant?: "lacquer" | "white";
  /** Smaller dice in a row (e.g. Rush). */
  compact?: boolean;
  label?: string;
}

export default function Dice({
  value,
  onRoll,
  disabled,
  rolling,
  compact,
  label,
}: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
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
        setDisplayValue(value ?? null);
      }, 1000);
    } else {
      setDisplayValue(value ?? null);
    }
  }, [value, rolling]);

  const face =
    displayValue != null
      ? Math.min(6, Math.max(1, displayValue))
      : null;
  const imgSize = compact ? 48 : 64;

  const inner = (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl md:rounded-2xl bg-white/95 shadow-lg border border-black/10",
        compact ? "w-14 h-14 md:w-16 md:h-16" : "w-[4.5rem] h-[4.5rem] md:w-20 md:h-20"
      )}
    >
      {face != null ? (
        <Image
          src={`/game/dice/${face}.png`}
          alt=""
          width={imgSize}
          height={imgSize}
          className={cn(
            "object-contain select-none",
            isRolling && "animate-pulse"
          )}
          unoptimized
        />
      ) : (
        <div
          className="rounded-lg bg-gradient-to-b from-gray-200 to-gray-400 opacity-70"
          style={{ width: imgSize * 0.85, height: imgSize * 0.85 }}
        />
      )}
      {isRolling && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
          <span className="text-[10px] font-bold text-gray-700">…</span>
        </div>
      )}
    </div>
  );

  if (onRoll) {
    return (
      <div className="flex flex-col items-center gap-1">
        {label && (
          <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
            {label}
          </span>
        )}
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled || isRolling}
          className={cn(
            "transition-all duration-300",
            "hover:scale-105 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            !disabled && !isRolling && "animate-pulse"
          )}
        >
          {inner}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
          {label}
        </span>
      )}
      <div className="opacity-90">{inner}</div>
    </div>
  );
}
