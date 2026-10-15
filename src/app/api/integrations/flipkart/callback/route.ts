import { flipkartOAuthConfig } from "@/lib/integrations/flipkart-oauth";
import { getSessionUserId } from "@/lib/security/session";
import { NextRequest, NextResponse } from "next/server";
import { verifyAndConsumeOAuthState } from "@/lib/security/oauth-state";
import { saveConnection, recordSyncLog } from "@/lib/security/marketplace-vault";
import { marketplaceError } from "@/lib/integrations/error-response";

const FLIPKART_TOKEN_URL = "https://api.flipkart.net/oauth-service/oauth/token";

/**
 * Handles the Flipkart OAuth 2.0 authorization callback.
 * Satisfies TASK-4.3:
 * - Verifies state parameter to prevent CSRF
 * - Exchanges authorization code for access & refresh tokens via server-to-server POST
 * - Encrypts tokens with AES-256-GCM and saves to marketplace_connections
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_DENIED",
        errorDescription || `Flipkart authorization portal returned error: ${errorParam}`,
        400
      );
    }

    if (!state) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_MISSING_STATE",
        "Missing required state nonce in authorization callback.",
        400
      );
    }

    // 1. Verify and consume state nonce (CSRF protection)
    const config = flipkartOAuthConfig(req.url);
    const stateVerification = await verifyAndConsumeOAuthState(state, "Flipkart", await getSessionUserId(req), config);
    if (!stateVerification.valid || !stateVerification.userId) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_INVALID_STATE",
        stateVerification.error || "Invalid or expired OAuth state nonce. Possible CSRF attack.",
        403
      );
    }

    const userId = stateVerification.userId;

    if (!code) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_MISSING_CODE",
        "Missing authorization code in Flipkart callback.",
        400
      );
    }

    // 2. Server-to-server code exchange for access & refresh tokens
    const { clientId, clientSecret, redirectUri } = config;

    let tokenRes: Response;
    try {
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });

      tokenRes = await fetch(FLIPKART_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "MarginFlow-Flipkart-OAuth/2.0",
        },
        body: tokenParams.toString(),
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
        redirect: "error",
      });
    } catch (err: any) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_GATEWAY_UNREACHABLE",
        `Could not reach Flipkart token exchange endpoint: ${err.message || "Timeout"}`,
        502
      );
    }

    if (!tokenRes.ok) {
      const errJson = await tokenRes.json().catch(() => ({}));
      const errMsg =
        errJson.error_description ||
        errJson.error ||
        `Flipkart token exchange returned HTTP ${tokenRes.status}.`;

      return marketplaceError("Flipkart", "FLIPKART_TOKEN_EXCHANGE_FAILED", errMsg, 502);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const sellerId = tokenData.seller_id || tokenData.account_id || "";

    if (!accessToken) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_TOKEN_EXCHANGE_FAILED",
        "Flipkart token service did not return an access token.",
        502
      );
    }

    // 3. Vault credentials server-side with AES-256-GCM (TASK-4.3)
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await saveConnection(userId, {
      marketplace: "Flipkart",
      sellerId: String(sellerId).trim(),
      authType: "OAUTH2",
      credentials: {
        accessToken,
        refreshToken: refreshToken || null,
        clientId,
        clientSecret,
        tokenExpiresAt,
      },
    });

    await recordSyncLog(userId, {
      marketplace: "Flipkart",
      syncType: "MANUAL",
      status: "SUCCEEDED",
      fetchedCount: 0,
      importedCount: 0,
    });

    const acceptHeader = req.headers.get("accept") || "";
    if (acceptHeader.includes("application/json")) {
      return NextResponse.json({
        success: true,
        message: "Flipkart OAuth 2.0 connection authenticated and securely vaulted.",
        authType: "OAUTH2",
        sellerId: sellerId || undefined,
      });
    }

    return NextResponse.redirect(new URL("/?channel=flipkart&status=connected", req.url));
  } catch (error: any) {
    return marketplaceError(
      "Flipkart",
      "FLIPKART_CALLBACK_ERROR",
      error.message || "Failed to process Flipkart OAuth callback.",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, state } = body;

    if (!state) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_MISSING_STATE",
        "Missing required state nonce in authorization payload.",
        400
      );
    }

    // Verify and consume state nonce
    const config = flipkartOAuthConfig(req.url);
    const stateVerification = await verifyAndConsumeOAuthState(state, "Flipkart", await getSessionUserId(req), config);
    if (!stateVerification.valid || !stateVerification.userId) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_INVALID_STATE",
        stateVerification.error || "Invalid or expired OAuth state nonce. Possible CSRF attack.",
        403
      );
    }

    const userId = stateVerification.userId;

    if (!code) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_OAUTH_MISSING_CODE",
        "Missing authorization code in Flipkart payload.",
        400
      );
    }

    const { clientId: appClientId, clientSecret: appClientSecret, redirectUri: callbackUri } = config;

    let tokenRes: Response;
    try {
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appClientId,
        client_secret: appClientSecret,
        redirect_uri: callbackUri,
      });

      tokenRes = await fetch(FLIPKART_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "MarginFlow-Flipkart-OAuth/2.0",
        },
        body: tokenParams.toString(),
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
        redirect: "error",
      });
    } catch (err: any) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_GATEWAY_UNREACHABLE",
        `Could not reach Flipkart token exchange endpoint: ${err.message || "Timeout"}`,
        502
      );
    }

    if (!tokenRes.ok) {
      const errJson = await tokenRes.json().catch(() => ({}));
      const errMsg =
        errJson.error_description ||
        errJson.error ||
        `Flipkart token exchange returned HTTP ${tokenRes.status}.`;

      return marketplaceError("Flipkart", "FLIPKART_TOKEN_EXCHANGE_FAILED", errMsg, 502);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const sellerId = tokenData.seller_id || tokenData.account_id || "";

    if (!accessToken) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_TOKEN_EXCHANGE_FAILED",
        "Flipkart token service did not return an access token.",
        502
      );
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await saveConnection(userId, {
      marketplace: "Flipkart",
      sellerId: String(sellerId).trim(),
      authType: "OAUTH2",
      credentials: {
        accessToken,
        refreshToken: refreshToken || null,
        clientId: appClientId,
        clientSecret: appClientSecret,
        tokenExpiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Flipkart OAuth 2.0 connection authenticated and securely vaulted.",
      authType: "OAUTH2",
      sellerId: sellerId || undefined,
    });
  } catch (error: any) {
    return marketplaceError(
      "Flipkart",
      "FLIPKART_CALLBACK_ERROR",
      error.message || "Failed to process Flipkart OAuth callback.",
      500
    );
  }
}
