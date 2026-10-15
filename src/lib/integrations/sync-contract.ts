import { Marketplace, Order } from "@/domain/types";
import { NextResponse } from "next/server";

export type SyncStatus = "pending" | "running" | "succeeded" | "partial" | "failed";

export interface SyncErrorItem {
  code: string;
  message: string;
}

/**
 * Unified Marketplace Sync Result Contract (Task 6.1)
 * Standardized across all marketplace sync connectors.
 */
export interface MarketplaceSyncResult {
  marketplace: Marketplace;
  status: SyncStatus;
  fetchedCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  lastSyncedAt: string;
  nextCursor?: string;
  errors: SyncErrorItem[];
}

/**
 * Standardized HTTP API response envelope extending the sync result.
 * Ensures zero regressions for existing consumers expecting `success`, `orders`, and `totalFetched`.
 */
export interface MarketplaceSyncEnvelope extends MarketplaceSyncResult {
  success: boolean;
  orders: Order[];
  totalFetched: number;
  nextToken?: string | null;
  message?: string;
  persisted?: {
    inserted: number;
    updated: number;
    orderIds: string[];
  };
}

/**
 * Factory to build a standardized MarketplaceSyncResult object.
 */
export function buildSyncResult(params: {
  marketplace: Marketplace;
  status?: SyncStatus;
  fetchedCount?: number;
  importedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  lastSyncedAt?: string;
  nextCursor?: string | null;
  errors?: SyncErrorItem[];
}): MarketplaceSyncResult {
  const errors = params.errors || [];
  let status = params.status;
  if (!status) {
    if (errors.length > 0 && (params.importedCount ?? 0) > 0) {
      status = "partial";
    } else if (errors.length > 0) {
      status = "failed";
    } else {
      status = "succeeded";
    }
  }

  return {
    marketplace: params.marketplace,
    status,
    fetchedCount: params.fetchedCount ?? 0,
    importedCount: params.importedCount ?? 0,
    updatedCount: params.updatedCount ?? 0,
    skippedCount: params.skippedCount ?? 0,
    lastSyncedAt: params.lastSyncedAt || new Date().toISOString(),
    ...(params.nextCursor ? { nextCursor: params.nextCursor } : {}),
    errors,
  };
}

/**
 * Helper to return a standardized Next.js JSON response complying with MarketplaceSyncEnvelope.
 */
export function syncSuccessResponse(
  result: MarketplaceSyncResult,
  extra?: {
    orders?: Order[];
    totalFetched?: number;
    message?: string;
    persisted?: { inserted: number; updated: number; orderIds: string[] };
    nextToken?: string | null;
  }
): NextResponse<MarketplaceSyncEnvelope> {
  const orders = extra?.orders || [];
  return NextResponse.json({
    ...result,
    success: result.status !== "failed",
    orders,
    totalFetched: extra?.totalFetched ?? result.fetchedCount,
    ...(extra?.message ? { message: extra.message } : {}),
    ...(extra?.persisted ? { persisted: extra.persisted } : {}),
    ...(extra?.nextToken !== undefined ? { nextToken: extra.nextToken } : {}),
  });
}
