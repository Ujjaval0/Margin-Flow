import { finishOAuth } from "@/lib/integrations/oauth-routes";

export const maxDuration = 120;

export async function GET(request: Request) {
  return finishOAuth(request, "amazon");
}
