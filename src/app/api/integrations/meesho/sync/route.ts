import { NextRequest } from "next/server";
import { marketplaceError } from "@/lib/integrations/error-response";

export async function POST(req: NextRequest) {
  try {
    // Meesho does not offer an open public REST API for direct merchant ERP order sync.
    // In accordance with Architecture Standard #1 (Zero Silent Fallbacks) and Task 1.2:
    // We reject synthetic order generation and false handshake verifications.
    // Merchants must import authentic Meesho Supplier GST Tax Invoice or Settlement reports (CSV/XLSX).
    return marketplaceError(
      "Meesho",
      "MEESHO_API_ACCESS_UNAVAILABLE",
      "Meesho does not provide a public REST API for automated order sync. Please upload your official Meesho Supplier GST Tax Invoice or Payment Settlement report (CSV/XLSX) in the Import modal.",
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
