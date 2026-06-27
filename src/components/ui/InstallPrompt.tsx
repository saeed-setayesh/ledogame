"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

function isCapacitorNativeWebView() {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  return (
    capacitor?.isNativePlatform?.() === true ||
    document.documentElement.classList.contains("cap-native")
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<{
    prompt: () => void;
    userChoice: Promise<unknown>;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/hosting-down")) {
      setVisible(false);
      return;
    }
    if (isCapacitorNativeWebView()) {
      setVisible(false);
      setDeferred(null);
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import("@capacitor/core").then(({ Capacitor }) => {
      if (cancelled || Capacitor.isNativePlatform()) {
        setVisible(false);
        setDeferred(null);
        return;
      }

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ===
          true;
      setIsStandalone(standalone);
      if (standalone) return;

      const ua = navigator.userAgent;
      const ios =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
      setIsIOS(ios && safari);

      function handler(e: Event) {
        if (isCapacitorNativeWebView()) return;
        e.preventDefault();
        setDeferred(e as { prompt: () => void; userChoice: Promise<unknown> });
        setVisible(true);
      }
      window.addEventListener("beforeinstallprompt", handler);

      if (ios && safari) {
        const dismissed = sessionStorage.getItem("pwa-install-dismissed");
        if (!dismissed) {
          const timer = setTimeout(() => setVisible(true), 3000);
          cleanup = () => {
            clearTimeout(timer);
            window.removeEventListener("beforeinstallprompt", handler);
          };
          return;
        }
      }

      cleanup = () =>
        window.removeEventListener("beforeinstallprompt", handler);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setVisible(false);
    setDeferred(null);
  }

  function dismiss() {
    setVisible(false);
    setDeferred(null);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  }

  if (!visible || isStandalone || isCapacitorNativeWebView()) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-999 flex justify-center">
      <div
        className="w-full max-w-sm rounded-2xl p-4 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(30,12,12,0.97), rgba(15,6,6,0.99))",
          border: "1px solid rgba(255,215,0,0.15)",
          boxShadow: "0 0 40px rgba(0,0,0,0.6), 0 0 20px rgba(212,56,44,0.15)",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 opacity-40 hover:opacity-80 transition-opacity"
          style={{ minHeight: "auto" }}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {isIOS ? (
          // iOS Safari: show manual instructions
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(180deg, #d4382c, #8b1a1a)",
                border: "2px solid rgba(255,215,0,0.3)",
              }}
            >
              <Share className="w-5 h-5" style={{ color: "#ffd700" }} />
            </div>
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: "#ffd700" }}>
                Add Ledo to Home Screen
              </div>
              <div className="text-xs opacity-60 leading-relaxed">
                Tap the <strong>Share</strong> button in Safari, then tap{" "}
                <strong>&quot;Add to Home Screen&quot;</strong> to install as an app.
              </div>
            </div>
          </div>
        ) : (
          // Chrome / Chromium: one-tap install
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(180deg, #d4382c, #8b1a1a)",
                border: "2px solid rgba(255,215,0,0.3)",
              }}
            >
              <Download className="w-5 h-5" style={{ color: "#ffd700" }} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm" style={{ color: "#ffd700" }}>
                Install Ledo Game
              </div>
              <div className="text-xs opacity-50">Play fullscreen like a native app</div>
            </div>
            <button
              onClick={install}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(180deg, #d4382c, #8b1a1a)",
                color: "#ffd700",
                border: "1px solid rgba(255,215,0,0.3)",
                boxShadow: "0 0 15px rgba(212,56,44,0.3)",
              }}
            >
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
