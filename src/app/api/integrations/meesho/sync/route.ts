import { NextRequest } from "next/server";
import { marketplaceError } from "@/lib/integrations/error-response";

export async function POST(req: NextRequest) {
  try {
    // This deployment has no approved Meesho partner endpoint/authentication contract.
    // In accordance with Architecture Standard #1 (Zero Silent Fallbacks) and Task 1.2:
    // We reject synthetic order generation and false handshake verifications.
    // Merchants must import authentic Meesho Supplier GST Tax Invoice or Settlement reports (CSV/XLSX).
    return marketplaceError(
      "Meesho",
      "MEESHO_API_ACCESS_UNAVAILABLE",
      "Direct Meesho API access requires an approved partner integration contract. Until it is configured, upload official Meesho Supplier GST Tax Invoice or Payment Settlement reports (CSV/XLSX).",
      501
    );
  } catch (error: any) {
    return marketplaceError(
      "Meesho",
      "MEESHO_API_ACCESS_UNAVAILABLE",
      "Meesho API sync is unavailable. Please use official CSV/XLSX supplier report uploads.",
      501
    );
  }
}
