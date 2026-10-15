import { collectPages } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { Settlement, SettlementDeduction, DeductionCategory } from "@/domain/types";
import { marketplaceError } from "@/lib/integrations/error-response";
import { getSessionUserId } from "@/lib/security/session";
import {
  getConnectionCredentials,
  getConnectionsForUser,
  updateSyncStatus,
  recordSyncLog,
} from "@/lib/security/marketplace-vault";
import { upsertSettlements } from "@/lib/integrations/order-persistence";

const SP_API_EU_BASE = "https://sellingpartnerapi-eu.amazon.com";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

/**
 * Exchanges LWA refresh token for an access token.
 */
async function getLwaAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string | null; error?: string; status?: number }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  try {
    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "MarginFlow-Amazon-Finances/2.0",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        accessToken: null,
        error:
          errJson.error_description ||
          errJson.error ||
          `Amazon LWA authentication failed with HTTP ${res.status}.`,
        status: res.status === 400 || res.status === 401 ? 401 : 502,
      };
    }

    const data = await res.json();
    return { accessToken: data.access_token || null };
  } catch (err: any) {
    return {
      accessToken: null,
      error: `Could not reach Amazon LWA service: ${err.message || "Network timeout"}`,
      status: 502,
    };
  }
}

/**
 * Categorizes an authentic Amazon fee into a MarginFlow DeductionCategory.
 */
function categorizeAmazonFee(feeType: string): { category: DeductionCategory; name: string } {
  const lower = (feeType || "").toLowerCase();
  if (lower.includes("commission") || lower.includes("referral")) {
    return { category: "COMMISSION", name: "Amazon Referral Fee" };
  }
  if (lower.includes("closing") || lower.includes("fixed")) {
    return { category: "FIXED_FEE", name: "Fixed Closing Fee" };
  }
  if (
    lower.includes("weighthandling") ||
    lower.includes("shipping") ||
    lower.includes("easyship") ||
    lower.includes("delivery") ||
    lower.includes("fba") ||
    lower.includes("pickpack")
  ) {
    return { category: "LOGISTICS", name: "Weight Handling / Logistics Fee" };
  }
  if (lower.includes("return") || lower.includes("refundfee")) {
    return { category: "RETURN_SHIPPING", name: "Return / Refund Fee" };
  }
  if (lower.includes("tcs")) {
    return { category: "TAX_TCS", name: "TCS GST Withheld" };
  }
  if (lower.includes("tds")) {
    return { category: "TAX_TDS", name: "TDS 194-O Withheld" };
  }
  if (lower.includes("penalty") || lower.includes("cancellation")) {
    return { category: "PENALTY", name: "Cancellation Penalty" };
  }
  return { category: "OTHER", name: feeType || "Marketplace Fee" };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Amazon India",
        "AUTHENTICATION_REQUIRED",
        "Authentication required to fetch Amazon financial events.",
        401
      );
    }
    const body = await req.json().catch(() => ({}));
    let {
      action = "fetch_finances",
      clientId,
      clientSecret,
      refreshToken,
      sellerId,
      orderId,
      cursor,
      nextToken,
      limit = 50,
    } = body;

    const requestedCursor = nextToken || cursor || null;

    // Zero Client-Side Master Secrets: Fetch vaulted credentials if not passed in body
    const connections = (await getConnectionsForUser(userId)).filter(c => c.marketplace === "Amazon India");
    if (connections.length > 1) throw new Error("Select an explicit store connection.");
    const vaultedMetadata = connections[0];
    const syncStartedAt = new Date().toISOString();
    if (!clientId || !clientSecret || !refreshToken) {
      const vaulted = await getConnectionCredentials<{
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        sellerId?: string;
        lastSyncedAt?: string;
        lastSyncCursor?: string;
      }>(userId, "Amazon India");

      if (vaulted?.clientId && vaulted?.clientSecret && vaulted?.refreshToken) {
        clientId = vaulted.clientId;
        clientSecret = vaulted.clientSecret;
        refreshToken = vaulted.refreshToken;
        if (!sellerId && vaulted.sellerId) sellerId = vaulted.sellerId;

      }
    }

    if (!clientId || !clientSecret || !refreshToken) {
      return marketplaceError(
        "Amazon India",
        "AMAZON_MISSING_CREDENTIALS",
        "Amazon LWA Client ID, Client Secret, and Refresh Token are required for Finances API. Please configure credentials in the vault.",
        400
      );
    }

    const cleanClientId = String(clientId).trim();
    const cleanClientSecret = String(clientSecret).trim();
    const cleanRefreshToken = String(refreshToken).trim();

    // 1. Authenticate with LWA
    const auth = await getLwaAccessToken(cleanClientId, cleanClientSecret, cleanRefreshToken);
    if (!auth.accessToken) {
      return marketplaceError(
        "Amazon India",
        auth.status === 401 ? "AMAZON_AUTH_FAILED" : "AMAZON_FINANCES_FAILED",
        auth.error || "Failed to exchange LWA token for Finances API.",
        auth.status || 502
      );
    }

    const accessToken = auth.accessToken;

    // 2. Query SP-API Finances API
    let financesUrl: string;
    if (orderId) {
      financesUrl = `${SP_API_EU_BASE}/finances/v0/orders/${encodeURIComponent(orderId)}/financialEvents`;
    } else if (requestedCursor) {
      financesUrl = `${SP_API_EU_BASE}/finances/v0/financialEvents?NextToken=${encodeURIComponent(
        requestedCursor
      )}&MaxResultsPerPage=${Math.min(limit, 50)}`;
    } else {
      const lastSyncedAt = vaultedMetadata?.syncCheckpoints?.finances?.lastSyncedAt;
      const postedAfter = lastSyncedAt
        ? new Date(new Date(lastSyncedAt).getTime() - 48 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      financesUrl = `${SP_API_EU_BASE}/finances/v0/financialEvents?PostedAfter=${encodeURIComponent(
        postedAfter
      )}&MaxResultsPerPage=${Math.min(limit, 50)}`;
    }

    const eventPages = await collectPages<any>(financesUrl, url => fetch(url, {
      headers: { "x-amz-access-token": accessToken, Accept: "application/json" },
      signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
    }), data => {
      const payload = data?.payload ?? data;
      if (!payload?.FinancialEvents || typeof payload.FinancialEvents !== "object") throw new Error("Amazon omitted financial events.");
      const next = payload.NextToken ? new URL(financesUrl) : null;
      if (next) next.searchParams.set("NextToken", payload.NextToken);
      return { records: [payload.FinancialEvents], next: next?.toString() };
    });
    if (action === "test_connection") return NextResponse.json({ success: true, message: "Amazon Finances API access verified." });
    const financialEvents: Record<string, any[]> = {};
    for (const page of eventPages) for (const [key, events] of Object.entries(page)) {
      if (!Array.isArray(events)) throw new Error("Invalid Amazon financial event collection.");
      (financialEvents[key] ||= []).push(...events);
    }
    const responseNextToken: string | null = null;

    // 3. Map authentic Financial Events into canonical Settlement records
    const settlements: Settlement[] = [];
    const shipmentEvents = financialEvents.ShipmentEventList || [];

    for (const shipEvent of shipmentEvents) {
      const channelOrderId = shipEvent.AmazonOrderId;
      if (!channelOrderId) continue;

      const postedDate = shipEvent.PostedDate || new Date().toISOString();
      const settlementDate = postedDate.split("T")[0];
      const batchId = `FIN-AMZ-${settlementDate.replace(/-/g, "")}`;

      let grossAmount = 0;
      let tcsTdsTax = 0;
      const deductions: SettlementDeduction[] = [];

      const shipmentItems = shipEvent.ShipmentItemList || [];
      for (const item of shipmentItems) {
        // Principal & shipping charges
        const chargeList = item.ItemChargeList || [];
        for (const chg of chargeList) {
          const amt = parseFloat(
            chg.ChargeAmount?.CurrencyAmount || chg.ChargeAmount?.Amount || "0"
          );
          if (chg.ChargeType === "Principal" || chg.ChargeType === "ShippingCharge") {
            grossAmount += Math.abs(amt);
          }
        }

        // Authentic fee itemization (Referral, Closing, Weight Handling, FBA)
        const feeList = item.ItemFeeList || [];
        for (const fee of feeList) {
          const feeAmt = Math.abs(
            parseFloat(fee.FeeAmount?.CurrencyAmount || fee.FeeAmount?.Amount || "0")
          );
          if (feeAmt > 0) {
            const { category, name } = categorizeAmazonFee(fee.FeeType);
            deductions.push({
              category,
              name: `${name} (${fee.FeeType})`,
              amount: Math.round(feeAmt * 100) / 100,
            });
          }
        }

        // Taxes withheld (TCS GST, TDS Section 194-O)
        const taxWithheldList = item.ItemTaxWithheldList || [];
        for (const tw of taxWithheldList) {
          const taxes = tw.TaxesWithheld || [];
          for (const tx of taxes) {
            const txAmt = Math.abs(
              parseFloat(tx.ChargeAmount?.CurrencyAmount || tx.ChargeAmount?.Amount || "0")
            );
            if (txAmt > 0) {
              const { category, name } = categorizeAmazonFee(tx.ChargeType);
              tcsTdsTax += txAmt;
              deductions.push({
                category,
                name: `${name} (${tx.ChargeType})`,
                amount: Math.round(txAmt * 100) / 100,
              });
            }
          }
        }
      }

      grossAmount = Math.round(grossAmount * 100) / 100;
      tcsTdsTax = Math.round(tcsTdsTax * 100) / 100;

      const nonTaxDeductions = deductions
        .filter((d) => d.category !== "TAX_TCS" && d.category !== "TAX_TDS")
        .reduce((sum, d) => sum + d.amount, 0);

      const netSettlement = Math.max(
        0,
        Math.round((grossAmount - nonTaxDeductions - tcsTdsTax) * 100) / 100
      );

      settlements.push({
        id: `SET-AMZ-${channelOrderId}`,
        settlementBatchId: batchId,
        marketplace: "Amazon India",
        settlementDate,
        orderId: `ORD-AMZ-${channelOrderId}`,
        grossAmount,
        deductions,
        tcsTdsTax,
        netSettlement,
        reconciliationStatus: "RECONCILED",
        discrepancyAmount: 0,
        sourceDocument: `Amazon SP-API Finances Event (${batchId})`,
      });
    }

    // 4. Atomic Database Upsert into settlements & settlement_deductions (TASK-3.4 / TASK-3.5)
    const dbResult = await upsertSettlements(userId, settlements);

    const nowIso = new Date().toISOString();
    if (!orderId && !requestedCursor) await updateSyncStatus(userId, "Amazon India", "SUCCEEDED", {
      stream: "finances",
      lastSyncedAt: syncStartedAt,
      lastSyncCursor: responseNextToken || undefined,
    });

    await recordSyncLog(userId, {
      marketplace: "Amazon India",
      syncType: "DELTA",
      status: "SUCCEEDED",
      fetchedCount: settlements.length,
      importedCount: dbResult.inserted,
      updatedCount: dbResult.updated,
    });

    return NextResponse.json({
      success: true,
      settlements,
      totalFetched: settlements.length,
      nextToken: responseNextToken,
      persisted: dbResult,
    });
  } catch (error: any) {
    return marketplaceError(
      "Amazon India",
      "AMAZON_FINANCES_FAILED",
      error.message || "Failed to execute Amazon SP-API Finances ingestion.",
      502
    );
  }
}
