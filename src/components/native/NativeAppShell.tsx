"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/** Web marketing routes — native app skips these for auth. */
const MARKETING_ROUTES = ["/", "/landing"];

export default function NativeAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isNative, setIsNative] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    let cancelled = false;

    void import("@capacitor/core").then(async ({ Capacitor }) => {
      if (cancelled || !Capacitor.isNativePlatform()) return;

      setIsNative(true);
      document.documentElement.classList.add("cap-native");

      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.hide();
      } catch {
        /* iOS may reject hide(); immersive still applied where supported */
      }
    });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove("cap-native");
    };
  }, []);

  useEffect(() => {
    if (!isNative || status === "loading") return;

    if (
      status === "unauthenticated" &&
      MARKETING_ROUTES.includes(pathname)
    ) {
      router.replace("/auth/signin");
      return;
    }

    if (status === "authenticated" && pathname === "/auth/signin") {
      router.replace("/");
    }
  }, [isNative, status, pathname, router]);

  return <>{children}</>;
}
