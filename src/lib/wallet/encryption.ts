import crypto from "crypto";
import { isProduction } from "@/lib/wallet/config";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    return crypto.scryptSync(raw, "ludino-wallet", 32);
  }
  if (isProduction()) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY is required in production (64-char hex or passphrase)"
    );
  }
  const fallback = process.env.NEXTAUTH_SECRET || "dev-wallet-encryption-unsafe";
  return crypto.scryptSync(fallback, "ludino-wallet-dev", 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted wallet key");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
