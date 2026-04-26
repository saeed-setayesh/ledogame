"use client";

import { useState } from "react";
import { Wallet, QrCode, Copy, ArrowDownCircle, Check } from "lucide-react";
import { generateQRCodeData } from "@/lib/wallet/mock-wallet";

interface DepositSectionProps {
  address: string;
  onDepositSuccess?: () => void;
}

export default function DepositSection({
  address,
  onDepositSuccess,
}: DepositSectionProps) {
  const [copied, setCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleGenerateQR = () => {
    const qrUrl = generateQRCodeData(address);
    setQrCodeUrl(qrUrl);
  };

  const handleMockDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setDepositing(true);
    try {
      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          isMock: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Deposit successful! New balance: ${data.newBalance} USDT`);
        setDepositAmount("");
        onDepositSuccess?.();
      } else {
        alert(data.error || "Deposit failed");
      }
    } catch (error) {
      console.error("Deposit error:", error);
      alert("Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Deposit USDT</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/70">
            Your TRON Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              readOnly
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg font-mono text-sm"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <Copy className="w-5 h-5 text-primary" />
              )}
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={handleGenerateQR}
            className="w-full py-3 bg-background border border-border rounded-lg font-semibold hover:bg-background/80 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <QrCode className="w-5 h-5" />
            {qrCodeUrl ? "Hide QR Code" : "Show QR Code"}
          </button>
          {qrCodeUrl && (
            <div className="mt-4 flex justify-center">
              <img
                src={qrCodeUrl}
                alt="Deposit QR Code"
                className="w-48 h-48 border border-border rounded-lg p-2 bg-white"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <label className="block text-sm font-medium mb-2 text-foreground/70">
            Quick Mock Deposit (Testing)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className="flex-1 px-4 py-2 bg-background border border-border rounded-lg min-h-[44px]"
            />
            <button
              onClick={handleMockDeposit}
              disabled={depositing || !depositAmount}
              className="px-6 py-2 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2 min-h-[44px]"
            >
              {depositing ? (
                "Processing..."
              ) : (
                <>
                  <ArrowDownCircle className="w-5 h-5" />
                  Deposit
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-foreground/50 mt-2">
            This is a mock deposit for testing. In production, send USDT to the
            address above.
          </p>
        </div>
      </div>
    </div>
  );
}
