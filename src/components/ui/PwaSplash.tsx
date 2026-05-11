"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ledo_splash_seen_session";

export default function PwaSplash() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    const mq = window.matchMedia("(display-mode: standalone)");
    const isStandalone =
      mq.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (!isStandalone) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (!v) return;
    const onEnd = () => dismiss();
    const onErr = () => dismiss();
    v.addEventListener("ended", onEnd);
    v.addEventListener("error", onErr);
    void v.play().catch(() => dismiss());
    return () => {
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("error", onErr);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      role="dialog"
      aria-label="Loading"
    >
      <video
        ref={videoRef}
        src="/splash.mp4"
        className="max-h-full max-w-full object-contain"
        playsInline
        muted
      />
      <button
        type="button"
        onClick={dismiss}
        className="absolute bottom-8 text-sm text-white/70 underline decoration-white/40"
      >
        Skip
      </button>
    </div>
  );
}
