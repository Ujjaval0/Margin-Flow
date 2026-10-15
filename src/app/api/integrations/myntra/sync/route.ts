import { NextRequest } from "next/server";
import { marketplaceError } from "@/lib/integrations/error-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "test_connection";

    // Myntra PPMP (Partner Portal Marketplace) and Omni APIs are restricted to contracted enterprise partners via dedicated VPN/whitelisted IP gateways.
    // In accordance with Architecture Standard #1 (Zero Silent Fallbacks) and Task 1.3 / Task 5.2:
    // Synthetic order generation and mock verification are purged.
    // Merchants must upload official Myntra Vendor Settlement sheets (CSV/XLSX).
    if (action === "test_connection" || action === "fetch_orders") {
      return marketplaceError(
        "Myntra",
        "MYNTRA_PPMP_ACCESS_UNAVAILABLE",
        "Myntra PPMP API direct synchronization requires whitelisted partner IP gateway access. Please upload your official Myntra Vendor Settlement spreadsheet (CSV/XLSX) to ingest your orders and deductions.",
        501
      );
    }

    return marketplaceError(
      "Myntra",
      "INVALID_ACTION",
      `Unsupported action: ${action}`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "Myntra",
      "MYNTRA_PPMP_ACCESS_UNAVAILABLE",
      "Myntra PPMP API sync is unavailable. Please use official vendor settlement spreadsheet uploads.",
      501
    );
  }
}
