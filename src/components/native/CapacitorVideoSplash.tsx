"use client";

import { useCallback, useEffect, useState } from "react";

const SPLASH_VIDEO = "/splash/launch.mp4";
/** Max time to show splash if video stalls (ms) */
const SPLASH_MAX_MS = 14_000;

export default function CapacitorVideoSplash({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isNative, setIsNative] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (cancelled) return;
      if (Capacitor.isNativePlatform()) {
        setIsNative(true);
        setShowOverlay(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hideNativeSplash = useCallback(async () => {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide().catch(() => {});
  }, []);

  const finishSplash = useCallback(() => {
    setShowOverlay(false);
  }, []);

  useEffect(() => {
    if (!showOverlay) return;
    document.documentElement.classList.add("cap-splash-lock");
    return () => {
      document.documentElement.classList.remove("cap-splash-lock");
    };
  }, [showOverlay]);

  useEffect(() => {
    if (!isNative || !showOverlay) return;
    const t = window.setTimeout(() => {
      void hideNativeSplash();
      finishSplash();
    }, SPLASH_MAX_MS);
    return () => window.clearTimeout(t);
  }, [isNative, showOverlay, finishSplash, hideNativeSplash]);

  const onPlaying = useCallback(() => {
    void hideNativeSplash();
  }, [hideNativeSplash]);

  const onEnded = useCallback(() => {
    finishSplash();
  }, [finishSplash]);

  const onVideoError = useCallback(() => {
    void hideNativeSplash();
    finishSplash();
  }, [finishSplash, hideNativeSplash]);

  return (
    <>
      {isNative && showOverlay && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black"
          aria-hidden
        >
          <video
            className="h-full w-full object-cover"
            src={SPLASH_VIDEO}
            playsInline
            muted
            autoPlay
            controls={false}
            onPlaying={onPlaying}
            onEnded={onEnded}
            onError={onVideoError}
          />
        </div>
      )}
      {children}
    </>
  );
}
