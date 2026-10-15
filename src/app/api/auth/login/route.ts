import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth-crypto";
import { issueSessionToken, getSessionCookieOptions } from "@/lib/security/session";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    const { email, password } = body;
    const budgetError = checkAuthBudget(request, email);
    if (budgetError) return budgetError;

    if (typeof email !== "string" || !email.trim() || email.length > 254) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (typeof password !== "string" || !password || password.length > 1024) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await query(
        `SELECT id, auth_user_id, name, email, password_hash, account_type, company_name, created_at
         FROM user_accounts
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cleanEmail]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: "Invalid email or password. Please check your credentials." },
          { status: 401 }
        );
      }

      const dbUser = res.rows[0];

      // OAuth-only accounts must authenticate through their identity provider.
      if (!dbUser.password_hash) {
        return NextResponse.json(
          { error: "Invalid email or password. Please check your credentials." },
          { status: 401 }
        );
      }

      if (dbUser.password_hash) {
        const isValid = await verifyPassword(password, dbUser.password_hash);
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid email or password. Please check your credentials." },
            { status: 401 }
          );
        }
      }

      if (!dbUser.password_hash.startsWith("pbkdf2-sha512:220000:")) {
        await query("UPDATE user_accounts SET password_hash = $1 WHERE id = $2 AND password_hash = $3", [
          await hashPassword(password), dbUser.id, dbUser.password_hash,
        ]);
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
        user: authenticatedUser,
      });

      // Set cryptographically signed, HTTP-only session cookie
      const cookieOpts = getSessionCookieOptions();
      response.cookies.set(cookieOpts.name, sessionToken, cookieOpts);

      return response;
    } catch (dbErr: any) {
      console.error("[Auth Login Database Error]:", dbErr.message);

      // Production-grade invariant: NEVER grant access on database error
      return NextResponse.json(
        { error: "Authentication service is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Auth Login Error]:", error);
    return NextResponse.json(
      { error: "Failed to process login" },
      { status: 500 }
    );
  }
}
