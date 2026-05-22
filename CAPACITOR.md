# LUDINO native apps (Capacitor)

This repo uses **[Capacitor 7](https://capacitorjs.com/)** so one JavaScript codebase powers **Android** and **iOS** shells.  
The shells load your **Next.js app inside a WebView** from `server.url` (`CAPACITOR_SERVER_URL`). That matches this project’s **Socket.io + API** server—you are **not** using a fully static export.

---

## Prerequisites

| Platform | Requirement |
|---------|--------------|
| **Node** | 18–20 recommended (CLI 8 needs Node ≥22; this project pins **Capacitor 7.6.x** so Node **20** works.) |
| **Android** | **Android Studio**, **JDK 17+** (`JAVA_HOME` must not point at JDK 11) |
| **iOS** (Mac only) | **Xcode**, **[CocoaPods](https://guides.cocoapods.org/using/getting-started.html)** (`brew install cocoapods`) |

---

## Splash video (your asset)

Source file:

`files/TG96dTjM1oYRh9dj5AjS95dDh8H5f3DdFKrrny6D.mp4`

It is copied to **`public/splash/launch.mp4`** and played **full-screen** on native only (`CapacitorVideoSplash.tsx`):

- **`muted`** + **`playsInline`** + **`autoPlay`** so iOS allows autoplay.
- When **`playing`** fires, the native **`SplashScreen`** plugin is **`hide()`’d**.
- Fallback: hides after **14s** or on **`error`**.

Keep the clip short for store UX; optimize size if needed.

Native splash config (`capacitor.config.ts`) keeps a black background and hides the spinner so the transition into the MP4 feels clean.

---

## Environment

```bash
# Required for device/emulator builds: URL your backend is reachable from the phone.

# LAN IP dev (same Wi‑Fi as the phone — not "localhost"):
export CAPACITOR_SERVER_URL="http://192.168.1.xx:3000"

# Production:
export CAPACITOR_SERVER_URL="https://your-domain.com"

npm run cap:sync
```

- **Android emulator** accessing dev machine: often `http://10.0.2.2:3000`.
- **`cleartext: true`** is enabled when using `http://` (see Android manifest `usesCleartextTraffic`).
- For **HTTPS** prod, use `https://` and you can tighten cleartext in a release flavour later.

---

## Commands

```bash
# After changing Capacitor config or plugins
npm run cap:sync

npm run cap:open:android   # Android Studio
npm run cap:open:ios     # Xcode (after iOS exists — see below)
```

### First-time iOS (if `ios/` is missing)

```bash
# Install CocoaPods first, then:
npx cap add ios
npm run cap:sync
npm run cap:open:ios
```

---

## File layout

| Path | Role |
|------|------|
| `capacitor.config.ts` | App ID `com.ludino.app`, `webDir`, `server`, splash/status-bar |
| `cap/www/index.html` | Minimal placeholder synced with native assets |
| `android/` | Android Studio project |
| `ios/` | Added after CocoaPods + `npx cap add ios` |

---

## Store submission checklist

1. Deploy the web/API stack to **`https://…`** and set **`CAPACITOR_SERVER_URL`** to it.
2. Run **`npm run cap:sync`**, then archive / bundle in Xcode / Play Console.
3. Ensure **privacy policy**, **support email** (`NEXT_PUBLIC_SUPPORT_EMAIL`), and **ATS** / network rules match Apple/Google requirements.
4. Optional: tighten **`usesCleartextTraffic`** off for HTTPS-only prod.

---

## Troubleshooting

- **Gradle: Java 11** → point `JAVA_HOME` to **JDK 17+**.
- **CocoaPods not installed** → `brew install cocoapods`.
- **`npx cap` requires Node 22** → you have Capacitor 8 CLI; downgrade to **`@capacitor/cli@7.6.5`** as in `package.json`.
- Blank WebView → phone cannot reach `CAPACITOR_SERVER_URL` (firewall, wrong IP, or HTTP blocked on device).
