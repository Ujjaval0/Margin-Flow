import { NextRequest } from "next/server";
import { marketplaceError } from "@/lib/integrations/error-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "test_connection";

    // Myntra PPMP/Omni authentication and network requirements depend on the approved partner contract.
    // In accordance with Architecture Standard #1 (Zero Silent Fallbacks) and Task 1.3 / Task 5.2:
    // Synthetic order generation and mock verification are purged.
    // Merchants must upload official Myntra Vendor Settlement sheets (CSV/XLSX).
    if (action === "test_connection" || action === "fetch_orders") {
      return marketplaceError(
        "Myntra",
        "MYNTRA_PPMP_ACCESS_UNAVAILABLE",
        "Direct Myntra PPMP/Omni synchronization requires its approved partner contract and callback configuration. Until it is configured, upload official Myntra reports (CSV/XLSX).",
        501
      );
    }

    return marketplaceError(
      "Myntra",
      "INVALID_ACTION",
      "Unsupported store operation.",
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
