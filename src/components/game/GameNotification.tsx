"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GameNotificationProps {
  message: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
  show: boolean;
  onClose: () => void;
}

export default function GameNotification({
  message,
  type = "info",
  duration = 3000,
  show,
  onClose,
}: GameNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, duration, onClose]);

  if (!show && !isVisible) return null;

  const typeStyles = {
    info: "bg-blue-500/90 text-white border-blue-400",
    warning: "bg-amber-500/90 text-white border-amber-400",
    success: "bg-green-500/90 text-white border-green-400",
    error: "bg-red-500/90 text-white border-red-400",
  };

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 transform -translate-x-1/2 z-50",
        "px-6 py-4 rounded-xl shadow-2xl border-2 backdrop-blur-md",
        "transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-full opacity-0 scale-95",
        typeStyles[type]
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {type === "warning" && (
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          {type === "info" && (
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <p className="font-semibold text-sm md:text-base">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
        >
          <svg
            className="w-5 h-5"
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
    </div>
  );
}
