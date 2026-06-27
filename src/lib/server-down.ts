/**
 * When `SERVER_DOWN=true`, all routes redirect to `/hosting-down`.
 * Use when hosting is suspended (e.g. unpaid bill) — not Ludino platform maintenance.
 */
export function isServerDown(): boolean {
  return process.env.SERVER_DOWN === "true";
}
