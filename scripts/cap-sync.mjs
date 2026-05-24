#!/usr/bin/env node
/**
 * Loads .env, writes a bootstrap page for offline fallback, then runs `cap sync`.
 * Without CAPACITOR_SERVER_URL the Android WebView only has cap/www (empty = black screen).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
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

const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? "").trim();
const nativeEntry = serverUrl
  ? `${serverUrl.replace(/\/$/, "")}/auth/signin`
  : "";
const wwwDir = path.join(root, "cap", "www");
fs.mkdirSync(wwwDir, { recursive: true });

const bootstrapHtml = nativeEntry
  ? `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>LUDINO</title>
  <style>
    html, body { margin: 0; height: 100%; background: #121618; color: #fff;
      font-family: system-ui, sans-serif; display: flex; align-items: center;
      justify-content: center; text-align: center; padding: 24px; }
    p { opacity: 0.85; max-width: 320px; line-height: 1.5; }
  </style>
  <script>
    window.location.replace(${JSON.stringify(nativeEntry)});
  </script>
</head>
<body>
  <p>Opening LUDINO…</p>
  <p><a href=${JSON.stringify(nativeEntry)} style="color:#f5c842">Tap here</a> if nothing loads.</p>
</body>
</html>`
  : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LUDINO — setup required</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #121618; color: #fff;
      font-family: system-ui, sans-serif; display: flex; align-items: center;
      justify-content: center; padding: 24px; }
    .box { max-width: 360px; line-height: 1.55; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; color: #f5c842; }
    code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Server URL not configured</h1>
    <p>Set <code>CAPACITOR_SERVER_URL</code> in <code>.env</code> (e.g. <code>https://ludino.net</code>), then run <code>npm run cap:sync</code> and rebuild the APK.</p>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(wwwDir, "index.html"), bootstrapHtml);

if (!serverUrl) {
  console.warn(
    "\n⚠️  CAPACITOR_SERVER_URL is missing — the native app will NOT load your site.\n" +
      "   Add it to .env and run npm run cap:sync again.\n"
  );
} else {
  console.log(`Capacitor server URL: ${nativeEntry}`);
}

const result = spawnSync("npx", ["cap", "sync"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
