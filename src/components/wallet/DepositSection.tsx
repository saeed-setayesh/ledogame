"use client";

import { useState } from "react";
import {
  Wallet,
  QrCode,
  Copy,
  RefreshCw,
  Check,
  ExternalLink,
} from "lucide-react";
import { generateQRCodeData } from "@/lib/wallet/mock-wallet";

interface DepositSectionProps {
  address: string;
  networkLabel?: string;
  usdtContract?: string;
  isTestnet?: boolean;
  explorerUrl?: string;
  onDepositSuccess?: () => void;
}

export default function DepositSection({
  address,
  networkLabel = "BNB Smart Chain",
  usdtContract,
  isTestnet,
  explorerUrl,
  onDepositSuccess,
}: DepositSectionProps) {
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const explorerBase = isTestnet
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleGenerateQR = () => {
    setQrCodeUrl(generateQRCodeData(address));
  };

  const handleConfirmDeposit = async () => {
    if (!txHash.trim()) {
      setError("Enter the BscScan transaction hash (0x…)");
      return;
    }
    setError(null);
    setMessage(null);
    setConfirming(true);
    try {
      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: txHash.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(
          `Credited ${data.amount} USDT. Balance: ${data.newBalance} USDT`
        );
        setTxHash("");
        onDepositSuccess?.();
      } else {
        setError(data.error || "Deposit confirmation failed");
      }
    } catch (err) {
      console.error(err);
      setError("Deposit confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  const handleSyncDeposits = async () => {
    setError(null);
    setMessage(null);
    setSyncing(true);
    try {
      const response = await fetch("/api/wallet/deposit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: fromAddress.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.credited > 0) {
          setMessage(
            `Found ${data.transactions?.length || 0} deposit(s), +${data.credited} USDT. Balance: ${data.balance} USDT`
          );
          onDepositSuccess?.();
        } else {
          setMessage(
            "No new deposits found. Send USDT (BEP20) to the Ludino address, then scan again or paste the tx hash."
          );
        }
      } else {
        setError(data.error || "Sync failed");
      }
    } catch (err) {
      console.error(err);
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Deposit USDT (BEP20)</h3>
      </div>

      <p className="text-sm text-foreground/70">
        Send <strong>USDT on {networkLabel}</strong> to the Ludino wallet below.
        Lower gas than Tron — good for small amounts (2–3 USDT). After sending,
        confirm with your transaction hash or scan.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/70">
            Ludino deposit address (BEP20)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              readOnly
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <Copy className="w-5 h-5 text-primary" />
              )}
            </button>
          </div>
          {usdtContract && (
            <p className="text-xs text-foreground/50 mt-2 font-mono break-all">
              USDT contract: {usdtContract}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleGenerateQR}
            className="flex-1 py-3 bg-background border border-border rounded-lg font-semibold flex items-center justify-center gap-2 min-h-[44px]"
          >
            <QrCode className="w-5 h-5" />
            {qrCodeUrl ? "Hide QR" : "Show QR"}
          </button>
          <button
            type="button"
            onClick={handleSyncDeposits}
            disabled={syncing}
            className="flex-1 py-3 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]"
          >
            <RefreshCw
              className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Scanning…" : "Scan for deposits"}
          </button>
        </div>

        {qrCodeUrl && (
          <div className="flex justify-center">
            <img
              src={qrCodeUrl}
              alt="Deposit QR"
              className="w-48 h-48 border border-border rounded-lg p-2 bg-white"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/70">
            Your sending wallet (optional, for scan)
          </label>
          <input
            type="text"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="0x… (your MetaMask / exchange address)"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg font-mono text-sm min-h-[44px]"
          />
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <label className="block text-sm font-medium text-foreground/70">
            Confirm with transaction hash
          </label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => {
              setTxHash(e.target.value);
              setError(null);
            }}
            placeholder="0x… transaction hash from BscScan"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg font-mono text-sm min-h-[44px]"
          />
          <button
            type="button"
            onClick={handleConfirmDeposit}
            disabled={confirming || !txHash.trim()}
            className="w-full py-3 bg-secondary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            {confirming ? "Confirming…" : "Confirm deposit"}
          </button>
          <a
            href={explorerUrl || `${explorerBase}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View on BscScan
          </a>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-sm text-success">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
