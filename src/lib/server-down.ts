/** When `SERVER_DOWN=true`, the app shows only the maintenance page. */
export function isServerDown(): boolean {
  return process.env.SERVER_DOWN === "true";
}
