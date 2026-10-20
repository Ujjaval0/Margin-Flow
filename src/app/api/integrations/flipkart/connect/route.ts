import { beginOAuth } from "@/lib/integrations/oauth-routes";

export async function GET(request: Request) {
  return beginOAuth(request, "flipkart");
}
