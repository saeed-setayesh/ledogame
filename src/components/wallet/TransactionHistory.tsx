"use client";

import { useState, useEffect } from "react";
import {
  History,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Gamepad2,
} from "lucide-react";
import { formatUSDT } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  txHash: string | null;
  description: string | null;
  gameId: string | null;
  createdAt: string;
}

interface TransactionHistoryProps {
  userId: string;
}

export default function TransactionHistory({
  userId,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchTransactions();
  }, [filterType, filterStatus]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("type", filterType);
      if (filterStatus !== "all") params.append("status", filterStatus);

      const response = await fetch(
        `/api/wallet/transactions?${params.toString()}`
      );
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return <ArrowDownCircle className="w-5 h-5 text-success" />;
      case "WITHDRAWAL":
        return <ArrowUpCircle className="w-5 h-5 text-danger" />;
      case "PAYOUT":
        return <DollarSign className="w-5 h-5 text-success" />;
      case "ENTRY_FEE":
        return <Gamepad2 className="w-5 h-5 text-primary" />;
      default:
        return <DollarSign className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-danger" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-accent" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeLabel = (type: string) => {
    return type
      .replace("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Transaction History</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground/70" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm min-h-[44px]"
          >
            <option value="all">All Types</option>
            <option value="DEPOSIT">Deposits</option>
            <option value="WITHDRAWAL">Withdrawals</option>
            <option value="ENTRY_FEE">Entry Fees</option>
            <option value="PAYOUT">Payouts</option>
          </select>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm min-h-[44px]"
        >
          <option value="all">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-foreground/70">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transactions found</p>
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1">{getTransactionIcon(tx.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {getTypeLabel(tx.type)}
                      </span>
                      {getStatusIcon(tx.status)}
                    </div>
                    {tx.description && (
                      <p className="text-sm text-foreground/70 truncate">
                        {tx.description}
                      </p>
                    )}
                    <p className="text-xs text-foreground/50 mt-1">
                      {formatDate(tx.createdAt)}
                    </p>
                    {tx.txHash && (
                      <p className="text-xs font-mono text-foreground/50 mt-1 truncate">
                        TX: {tx.txHash.slice(0, 16)}...
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold text-lg ${
                      tx.type === "DEPOSIT" || tx.type === "PAYOUT"
                        ? "text-success"
                        : "text-danger"
                    }`}
                  >
                    {tx.type === "DEPOSIT" || tx.type === "PAYOUT" ? "+" : "-"}
                    {formatUSDT(tx.amount)} USDT
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
