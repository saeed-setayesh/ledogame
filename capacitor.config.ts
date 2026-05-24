import type { CapacitorConfig } from "@capacitor/cli";
import fs from "fs";
import path from "path";

/** Load .env so `npm run cap:sync` picks up CAPACITOR_SERVER_URL without manual export. */
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

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

/** Native cold start opens sign-in (not marketing landing). */
function nativeEntryUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/auth/signin`;
}

const config: CapacitorConfig = {
  appId: "com.ludino.app",
  appName: "LUDINO",
  webDir: "cap/www",
  ...(serverUrl
    ? {
        server: {
          url: nativeEntryUrl(serverUrl),
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      /** Hide after 3s if JS never calls SplashScreen.hide() (e.g. network error). */
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#121618",
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
