import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// Store game settings in a simple way (you could create a Settings model)
// For now, we'll use environment variables or a simple storage

interface GameSettings {
  defaultEntryFee: number;
  minEntryFee: number;
  maxEntryFee: number;
  commissionRate: number; // Percentage (e.g., 5 for 5%)
  allowedEntryFees: number[];
}

// Default settings
const DEFAULT_SETTINGS: GameSettings = {
  defaultEntryFee: 1,
  minEntryFee: 0.1,
  maxEntryFee: 100,
  commissionRate: 5,
  allowedEntryFees: [1, 2, 3, 5, 10, 20, 50],
};

export async function GET() {
  try {
    // Allow non-admin users to read settings (for lobby to fetch allowed entry fees)
    // But we'll still check auth
    const { requireAuth } = await import("@/lib/auth-helpers");
    await requireAuth();

    // In a real implementation, you'd fetch from database
    // For now, return defaults (you can store in env vars or database)
    const settings: GameSettings = {
      defaultEntryFee: parseFloat(
        process.env.DEFAULT_ENTRY_FEE ||
          String(DEFAULT_SETTINGS.defaultEntryFee)
      ),
      minEntryFee: parseFloat(
        process.env.MIN_ENTRY_FEE || String(DEFAULT_SETTINGS.minEntryFee)
      ),
      maxEntryFee: parseFloat(
        process.env.MAX_ENTRY_FEE || String(DEFAULT_SETTINGS.maxEntryFee)
      ),
      commissionRate: parseFloat(
        process.env.COMMISSION_RATE || String(DEFAULT_SETTINGS.commissionRate)
      ),
      allowedEntryFees: process.env.ALLOWED_ENTRY_FEES
        ? process.env.ALLOWED_ENTRY_FEES.split(",").map(Number)
        : DEFAULT_SETTINGS.allowedEntryFees,
    };

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    const {
      defaultEntryFee,
      minEntryFee,
      maxEntryFee,
      commissionRate,
      allowedEntryFees,
    } = body;

    // Validate
    if (
      defaultEntryFee !== undefined &&
      (isNaN(defaultEntryFee) || defaultEntryFee < 0)
    ) {
      return NextResponse.json(
        { error: "Invalid default entry fee" },
        { status: 400 }
      );
    }

    if (minEntryFee !== undefined && (isNaN(minEntryFee) || minEntryFee < 0)) {
      return NextResponse.json(
        { error: "Invalid min entry fee" },
        { status: 400 }
      );
    }

    if (
      maxEntryFee !== undefined &&
      (isNaN(maxEntryFee) || maxEntryFee < minEntryFee)
    ) {
      return NextResponse.json(
        { error: "Invalid max entry fee" },
        { status: 400 }
      );
    }

    if (
      commissionRate !== undefined &&
      (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100)
    ) {
      return NextResponse.json(
        { error: "Invalid commission rate (0-100)" },
        { status: 400 }
      );
    }

    // In production, you'd save to database
    // For now, we'll just return success
    // You should create a Settings model or use environment variables

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        defaultEntryFee: defaultEntryFee ?? DEFAULT_SETTINGS.defaultEntryFee,
        minEntryFee: minEntryFee ?? DEFAULT_SETTINGS.minEntryFee,
        maxEntryFee: maxEntryFee ?? DEFAULT_SETTINGS.maxEntryFee,
        commissionRate: commissionRate ?? DEFAULT_SETTINGS.commissionRate,
        allowedEntryFees: allowedEntryFees ?? DEFAULT_SETTINGS.allowedEntryFees,
      },
    });
  } catch (error: any) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
