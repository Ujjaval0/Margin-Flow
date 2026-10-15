import { flipkartOAuthConfig } from "@/lib/integrations/flipkart-oauth";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { createOAuthState } from "@/lib/security/oauth-state";
import { marketplaceError } from "@/lib/integrations/error-response";

const FLIPKART_AUTH_URL = "https://api.flipkart.net/oauth-service/oauth/authorize";


/**
 * Initiates the multi-tenant Flipkart Seller OAuth 2.0 connection workflow.
 * Satisfies TASK-4.2:
 * - Generates cryptographically secure random state nonce
 * - Caches state in DB / secure vault with 10-minute expiry bound to merchant's user_id
 * - Redirects merchant to Flipkart Seller Hub authorization portal
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Flipkart",
        "AUTHENTICATION_REQUIRED",
        "Authentication required to initialize Flipkart connection.",
        401
      );
    }
    const searchParams = req.nextUrl.searchParams;

    const { clientId, redirectUri } = flipkartOAuthConfig(req.url);
    const state = await createOAuthState(userId, "Flipkart", 10 * 60 * 1000, { clientId, redirectUri });

    const authUrl = new URL(FLIPKART_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "Seller_Api");

    const format = searchParams.get("format");
    const acceptHeader = req.headers.get("accept") || "";

    if (format === "json" || acceptHeader.includes("application/json")) {
      return NextResponse.json({
        success: true,
        authorizationUrl: authUrl.toString(),
        state,
        expiresIn: 600,
        marketplace: "Flipkart",
        authType: "OAUTH2",
      });
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    return marketplaceError(
      "Flipkart",
      "FLIPKART_CONNECT_FAILED",
      error.message || "Failed to initialize Flipkart OAuth connection flow.",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Flipkart",
        "AUTHENTICATION_REQUIRED",
        "Authentication required to initialize Flipkart connection.",
        401
      );
    }
    const body = await req.json().catch(() => ({}));

    const { clientId, redirectUri } = flipkartOAuthConfig(req.url);
    const state = await createOAuthState(userId, "Flipkart", 10 * 60 * 1000, { clientId, redirectUri });

    const authUrl = new URL(FLIPKART_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "Seller_Api");

    return NextResponse.json({
      success: true,
      authorizationUrl: authUrl.toString(),
      state,
      expiresIn: 600,
      marketplace: "Flipkart",
      authType: "OAUTH2",
    });
  } catch (error: any) {
    return marketplaceError(
      "Flipkart",
      "FLIPKART_CONNECT_FAILED",
      error.message || "Failed to initialize Flipkart OAuth connection flow.",
      500
    );
  }
}
