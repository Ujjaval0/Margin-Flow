import { NextRequest } from "next/server";
import { integrationRoute } from "@/lib/integrations/integration-route";
import { runSync } from "@/lib/integrations/providers/flipkart-sync";

export const maxDuration = 300;
export async function POST(req: NextRequest) {
  return integrationRoute(req, "Flipkart", runSync, "fetch_orders");
}
