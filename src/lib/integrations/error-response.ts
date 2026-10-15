import { NextResponse } from "next/server";
import { Marketplace } from "@/domain/types";
import { MarketplaceSyncResult } from "./sync-contract";

export interface MarketplaceErrorEnvelope extends MarketplaceSyncResult {
  success: false;
  code: string;
  error: string;
  marketplace: Marketplace;
  timestamp: string;
}

/**
 * Standardized error envelope for all marketplace synchronization and connection endpoints.
 * Complies with Architecture Standard #1 (Zero Silent Fallbacks), Task 1.5, and Task 6.1 (Unified Contract).
 */
export function marketplaceError(
  marketplace: string,
  code: string,
  error: string,
  status: number = 400
): NextResponse<MarketplaceErrorEnvelope> {
  const timestamp = new Date().toISOString();
  return NextResponse.json(
    {
      success: false,
      code,
      error,
      marketplace: marketplace as Marketplace,
      timestamp,
      // MarketplaceSyncResult Unified Contract fields (TASK-6.1):
      status: "failed",
      fetchedCount: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      lastSyncedAt: timestamp,
      errors: [{ code, message: error }],
    },
    { status }
  );
}
