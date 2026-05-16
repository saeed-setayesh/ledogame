"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DiceProps {
  value: number | null;
  onRoll?: () => void;
  disabled?: boolean;
  /** External trigger (optional); local click also starts a roll. */
  rolling?: boolean;
  variant?: "lacquer" | "white";
  /** Smaller dice in a row (e.g. Rush). */
  compact?: boolean;
  label?: string;
  /** Red circular shell (play-table style). Ignored when `compact`. */
  ludino?: boolean;
}

export default function Dice({
  value,
  onRoll,
  disabled,
  compact,
  label,
  ludino = false,
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

  const startSpinFaces = useCallback(() => {
    clearSpinTimers();
    setIsRolling(true);
    // #region agent log
    fetch("http://127.0.0.1:7400/ingest/1d450167-b174-499a-936a-1a9f2340e5c6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f011d2",
      },
      body: JSON.stringify({
        sessionId: "f011d2",
        runId: "pre-fix",
        hypothesisId: "F",
        location: "Dice.tsx:startSpinFaces",
        message: "local spin started",
        data: { propValue: value },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    intervalRef.current = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 85);
    safetyRef.current = setTimeout(() => {
      if (!intervalRef.current) return;
      // #region agent log
      fetch("http://127.0.0.1:7400/ingest/1d450167-b174-499a-936a-1a9f2340e5c6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f011d2",
        },
        body: JSON.stringify({
          sessionId: "f011d2",
          runId: "pre-fix",
          hypothesisId: "I",
          location: "Dice.tsx:safetyTimeout",
          message: "safety timeout fired (spin still running)",
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      clearSpinTimers();
      setIsRolling(false);
      setDisplayValue(value ?? null);
    }, 2800);
  }, [clearSpinTimers, value]);

  const finishSpin = useCallback(
    (finalFace: number | null) => {
      clearSpinTimers();
      setIsRolling(false);
      setDisplayValue(finalFace);
    },
    [clearSpinTimers]
  );

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (prev === undefined) {
      setDisplayValue(value ?? null);
      return;
    }
    if (value === prev) return;

    if (value === null) {
      clearSpinTimers();
      setIsRolling(false);
      setDisplayValue(null);
      return;
    }

    clearSpinTimers();
    setIsRolling(true);
    // #region agent log
    fetch("http://127.0.0.1:7400/ingest/1d450167-b174-499a-936a-1a9f2340e5c6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f011d2",
      },
      body: JSON.stringify({
        sessionId: "f011d2",
        runId: "pre-fix",
        hypothesisId: "F",
        location: "Dice.tsx:valueEffect",
        message: "server value changed; starting settle spin",
        data: { prev, value },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    intervalRef.current = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
    }, 85);
    settleRef.current = setTimeout(() => {
      // #region agent log
      fetch("http://127.0.0.1:7400/ingest/1d450167-b174-499a-936a-1a9f2340e5c6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f011d2",
        },
        body: JSON.stringify({
          sessionId: "f011d2",
          runId: "pre-fix",
          hypothesisId: "G",
          location: "Dice.tsx:settleTimeout",
          message: "settle fired",
          data: { final: value },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      finishSpin(value);
    }, 720);
    return clearSpinTimers;
  }, [value, clearSpinTimers, finishSpin]);

  useEffect(() => () => clearSpinTimers(), [clearSpinTimers]);

  const handleRollClick = () => {
    if (!onRoll || disabled || isRolling) return;
    startSpinFaces();
    onRoll();
  };

  const face =
    displayValue != null
      ? Math.min(6, Math.max(1, displayValue))
      : null;
  const imgSize = compact ? 48 : 64;

  const inner = (
    <div
      className={cn(
        "relative flex items-center justify-center bg-white/95 shadow-lg border border-black/10",
        compact
          ? "rounded-xl md:rounded-2xl w-14 h-14 md:w-16 md:h-16"
          : ludino
            ? "rounded-full w-16 h-16 md:w-[4.35rem] md:h-[4.35rem]"
            : "rounded-xl md:rounded-2xl w-[4.5rem] h-[4.5rem] md:w-20 md:h-20"
      )}
    >
      {face != null ? (
        <Image
          src={`/game/dice/${face}.png`}
          alt=""
          width={imgSize}
          height={imgSize}
          className={cn(
            "object-contain select-none will-change-transform",
            isRolling && "animate-dice-roll-infinite"
          )}
          unoptimized
        />
      ) : (
        <div
          className="rounded-lg bg-gradient-to-b from-gray-200 to-gray-400 opacity-70"
          style={{ width: imgSize * 0.85, height: imgSize * 0.85 }}
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
            ludino &&
              !compact &&
              "rounded-full p-2 md:p-2.5 bg-gradient-to-b from-red-500 via-red-700 to-red-950 border border-red-950/60 shadow-[0_8px_24px_rgba(0,0,0,0.5)]",
            "hover:scale-105 active:scale-95",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            !disabled && !isRolling && !ludino && "animate-pulse",
            !disabled && !isRolling && ludino && !compact && "hover:brightness-110"
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
