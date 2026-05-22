import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell loads your Next.js app from `server.url` (WebView).
 * Required for Socket.io + API routes — the app does not ship as a static export.
 *
 * Dev on a device/emulator:
 *   CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000 npx cap sync
 * Use the same Wi‑Fi IP your phone can reach (not localhost).
 *
 * Production:
 *   CAPACITOR_SERVER_URL=https://your-domain.com npx cap sync
 */
const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? "").trim();

const config: CapacitorConfig = {
  appId: "com.ludino.app",
  appName: "LUDINO",
  webDir: "cap/www",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#000000",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#000000",
    },
  },
};

export default config;
