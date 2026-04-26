"use client";

import { useState, useEffect } from "react";
import { formatUSDT } from "@/lib/utils";
import { Coins, TrendingUp, ArrowUpCircle, Send, Wallet } from "lucide-react";
import DepositSection from "./DepositSection";
import TransactionHistory from "./TransactionHistory";

interface WalletDashboardProps {
  userId: string;
}

export default function WalletDashboard({ userId }: WalletDashboardProps) {
  const [balance, setBalance] = useState("0");
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch("/api/wallet/balance");
      const data = await response.json();
      setBalance(data.balance || "0");
      setAddress(data.address);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAddress || !withdrawAmount) {
      setWithdrawError("Please enter address and amount");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid amount");
      return;
    }

    if (amount > parseFloat(balance)) {
      setWithdrawError("Insufficient balance");
      return;
    }

    setWithdrawError(null);
    setWithdrawSuccess(false);
    setWithdrawing(true);

    try {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: withdrawAddress,
          amount: amount,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWithdrawSuccess(true);
        setWithdrawAddress("");
        setWithdrawAmount("");
        setTimeout(() => setWithdrawSuccess(false), 3000);
        fetchBalance();
      } else {
        setWithdrawError(data.error || "Withdrawal failed");
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      setWithdrawError("Withdrawal failed. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-4 md:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold">Wallet Balance</h2>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <div className="text-3xl md:text-4xl font-bold text-primary">
              {formatUSDT(balance)}
            </div>
            <div className="text-lg text-foreground/70">USDT</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <TrendingUp className="w-4 h-4" />
            <span>Available for withdrawal</span>
          </div>
          {address && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="text-xs text-foreground/50 mb-1">
                Wallet Address
              </div>
              <div className="font-mono text-xs md:text-sm break-all text-foreground/70">
                {address}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Section */}
      {address && (
        <DepositSection address={address} onDepositSuccess={fetchBalance} />
      )}

      {/* Withdraw Section */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpCircle className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Withdraw USDT</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground/70">
              TRON Address
            </label>
            <input
              type="text"
              value={withdrawAddress}
              onChange={(e) => {
                setWithdrawAddress(e.target.value);
                setWithdrawError(null);
              }}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="T..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground/70">
              Amount (USDT)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => {
                setWithdrawAmount(e.target.value);
                setWithdrawError(null);
              }}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0.00"
              min="0.01"
              step="0.01"
            />
          </div>
          {withdrawError && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
              {withdrawError}
            </div>
          )}
          {withdrawSuccess && (
            <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-sm text-success">
              Withdrawal initiated successfully!
            </div>
          )}
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="w-full py-3 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-[44px]"
          >
            {withdrawing ? (
              "Processing..."
            ) : (
              <>
                <Send className="w-5 h-5" />
                Withdraw
              </>
            )}
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory userId={userId} />
    </div>
  );
}
