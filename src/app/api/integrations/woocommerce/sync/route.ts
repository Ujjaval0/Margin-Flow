import { NextRequest } from "next/server";
import { integrationRoute } from "@/lib/integrations/integration-route";
import { runSync } from "@/lib/integrations/providers/woocommerce-sync";

export const maxDuration = 300;
export async function POST(req: NextRequest) {
  return integrationRoute(req, "WooCommerce", runSync, "fetch_orders");
}
