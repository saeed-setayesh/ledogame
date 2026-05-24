"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DiceProps {
  value: number | null;
  onRoll?: () => void;
  disabled?: boolean;
  rolling?: boolean;
  variant?: "lacquer" | "white";
  compact?: boolean;
  label?: string;
}

export default function Dice({
  value,
  onRoll,
  disabled,
  variant = "white",
  compact,
  label,
}: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const [isRolling, setIsRolling] = useState(false);
  const prevValueRef = useRef<number | null | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSpinTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (settleRef.current) clearTimeout(settleRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    intervalRef.current = null;
    settleRef.current = null;
    safetyRef.current = null;
  }, []);

  const finishSpin = useCallback(
    (finalFace: number | null) => {
      clearSpinTimers();
      setIsRolling(false);
      setDisplayValue(finalFace);
    },
    [clearSpinTimers]
  );

  const startSpinFaces = useCallback(() => {
    clearSpinTimers();
    setIsRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 85);
    safetyRef.current = setTimeout(() => {
      if (!intervalRef.current) return;
      clearSpinTimers();
      setIsRolling(false);
      setDisplayValue(value ?? null);
    }, 2800);
  }, [clearSpinTimers, value]);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (prev === undefined) {
      return;
    }
    if (value === prev) return;

    if (value === null) {
      clearSpinTimers();
      const resetTimer = setTimeout(() => {
        setIsRolling(false);
        setDisplayValue(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    clearSpinTimers();
    const startTimer = setTimeout(() => {
      setIsRolling(true);
      intervalRef.current = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 85);
      settleRef.current = setTimeout(() => {
        finishSpin(value);
      }, 720);
    }, 0);
    return () => {
      clearTimeout(startTimer);
      clearSpinTimers();
    };
  }, [value, clearSpinTimers, finishSpin]);

  useEffect(() => () => clearSpinTimers(), [clearSpinTimers]);

  const handleRollClick = () => {
    if (!onRoll || disabled || isRolling) return;
    startSpinFaces();
    onRoll();
  };

  const face = displayValue != null ? Math.min(6, Math.max(1, displayValue)) : null;
  const imgSize = compact ? 48 : 72;
  const containerSize = compact
    ? "w-14 h-14 md:w-16 md:h-16"
    : "w-[4.5rem] h-[4.5rem] md:w-20 md:h-20";

  const pipsByFace: Record<number, Array<[number, number]>> = {
    1: [[50, 50]],
    2: [
      [30, 30],
      [70, 70],
    ],
    3: [
      [30, 30],
      [50, 50],
      [70, 70],
    ],
    4: [
      [30, 30],
      [70, 30],
      [30, 70],
      [70, 70],
    ],
    5: [
      [30, 30],
      [70, 30],
      [50, 50],
      [30, 70],
      [70, 70],
    ],
    6: [
      [30, 27],
      [70, 27],
      [30, 50],
      [70, 50],
      [30, 73],
      [70, 73],
    ],
  };

  const inner = (
    <div className={cn("relative flex items-center justify-center", containerSize)}>
      {variant === "lacquer" ? (
        <div
          className={cn(
            "relative h-14 w-14 rounded-2xl bg-linear-to-b from-[#f2f2ee] to-[#d6d6d3] shadow-[inset_0_2px_5px_rgba(255,255,255,0.85),inset_0_-4px_8px_rgba(0,0,0,0.18),0_4px_8px_rgba(0,0,0,0.35)]",
            isRolling && "animate-dice-roll-infinite"
          )}
        >
          {(pipsByFace[face ?? 6] ?? pipsByFace[6]).map(([x, y], i) => (
            <span
              key={`${x}-${y}-${i}`}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#444] shadow-inner"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}
        </div>
      ) : face != null ? (
        <Image
          src={`/game/dice/${face}.png`}
          alt={String(face)}
          width={imgSize}
          height={imgSize}
          className={cn(
            "object-contain select-none will-change-transform w-full h-full",
            "drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
            isRolling && "animate-dice-roll-infinite"
          )}
          unoptimized
        />
      ) : (
        <Image
          src="/game/dice/6.png"
          alt=""
          width={imgSize}
          height={imgSize}
          className="object-contain w-full h-full opacity-45"
          unoptimized
        />
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
          onClick={handleRollClick}
          disabled={disabled || isRolling}
          className={cn(
            "transition-all duration-300",
            "hover:scale-110 active:scale-95",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
            !disabled && !isRolling && "animate-pulse drop-shadow-[0_0_12px_rgba(255,220,50,0.6)]"
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
