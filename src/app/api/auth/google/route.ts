import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { query } from "@/lib/db";
import { issueSessionToken, getSessionCookieOptions } from "@/lib/security/session";

interface GoogleTokenInfo {
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
  aud?: string;
  error_description?: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    const { credential, idToken, name, email, accountType } = body;
    const budgetError = checkAuthBudget(request, email);
    if (budgetError) return budgetError;

    const tokenToVerify = credential || idToken;

    if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
      return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
    }

    let verifiedEmail = "";
    let verifiedName = "";
    const validAccountType = accountType || "BRAND_OWNER";

    // 1. Verify Google OAuth token if provided
    if (tokenToVerify && typeof tokenToVerify === "string") {
      try {
        const googleRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify.trim())}`,
          { method: "GET", signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store" }
        );

        if (!googleRes.ok) {
          const errData = await googleRes.json().catch(() => ({}));
          return NextResponse.json(
            { error: `Google token verification failed: ${errData.error_description || "Invalid token"}` },
            { status: 401 }
          );
        }

        const tokenInfo: GoogleTokenInfo = await googleRes.json();

        // Enforce verified email
        const isVerified =
          tokenInfo.email_verified === true ||
          tokenInfo.email_verified === "true";

        if (!isVerified || !tokenInfo.email) {
          return NextResponse.json(
            { error: "Google account email is not verified" },
            { status: 403 }
          );
        }

        // Validate client ID if configured in environment
        if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
          return NextResponse.json(
            { error: "Google token audience mismatch" },
            { status: 403 }
          );
        }

        verifiedEmail = tokenInfo.email.trim().toLowerCase();
        verifiedName = tokenInfo.name || name || "Google User";
      } catch (verifyErr: any) {
        console.error("[Auth Google] Google token verification error:", verifyErr);
        return NextResponse.json(
          { error: "Failed to communicate with Google token verification service" },
          { status: 502 }
        );
      }
    } else {
      // If token is missing: In production, this is a fatal 401.
      if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_FALLBACK_AUTH !== "true") {
        return NextResponse.json(
          { error: "Missing Google ID token credential. Unauthorized." },
          { status: 401 }
        );
      }

      // Development testing convenience (warns explicitly)
      console.warn(
        "[Auth Google] Development mode: Accepting local unverified OAuth payload (credential token was omitted)."
      );
      verifiedEmail = (email || "founder@marginflow.io").trim().toLowerCase();
      verifiedName = (name || "Google User").trim();
    }

    try {
      // 2. Check if user already exists
      const existing = await query(
        `SELECT id, auth_user_id, name, email, account_type, company_name, created_at
         FROM user_accounts
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [verifiedEmail]
      );

      let dbUser: any;
      let isNewUser = false;

      if (existing.rows.length > 0) {
        dbUser = existing.rows[0];
      } else {
        // 3. Insert new user into PostgreSQL
        const insertRes = await query(
          `INSERT INTO user_accounts (name, email, account_type)
           VALUES ($1, $2, $3)
           RETURNING id, auth_user_id, name, email, account_type, company_name, created_at`,
          [verifiedName, verifiedEmail, validAccountType]
        );
        dbUser = insertRes.rows[0];
        isNewUser = true;
      }

      const authenticatedUser = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        accountType: dbUser.account_type,
        companyName: dbUser.company_name || "My Brand",
        authenticatedAt: new Date().toISOString(),
      };

      // Sign cryptographic session token
      const sessionToken = await issueSessionToken(authenticatedUser);

      const response = NextResponse.json({
        success: true,
        isNewUser,
        user: authenticatedUser,
      });

      // Set cryptographically signed HTTP-only cookie
      const cookieOpts = getSessionCookieOptions();
      response.cookies.set(cookieOpts.name, sessionToken, cookieOpts);

      return response;
    } catch (dbErr: any) {
      console.error("[Auth Google Database Error]:", dbErr.message);

      return NextResponse.json(
        { error: "Authentication service is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Auth Google Error]:", error);
    return NextResponse.json(
      { error: "Failed to process Google authentication" },
      { status: 500 }
    );
  }
}
