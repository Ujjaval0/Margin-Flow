import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth-crypto";
import { issueSessionToken, getSessionCookieOptions } from "@/lib/security/session";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    const { name, email, password, accountType } = body;
    const budgetError = checkAuthBudget(request, email);
    if (budgetError) return budgetError;

    if (typeof name !== "string" || !name.trim() || name.length > 200) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (typeof email !== "string" || !email.trim() || email.length > 254) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
      return NextResponse.json(
        { error: "Password must contain between 12 and 1024 characters" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const validAccountType = accountType || "BRAND_OWNER";

    // Hash password with salt
    const hashedPassword = await hashPassword(password);

    try {
      // 1. Check if user already exists in PostgreSQL
      const existing = await query(
        `SELECT id, email FROM user_accounts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [cleanEmail]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      // 2. Insert into PostgreSQL user_accounts
      const insertRes = await query(
        `INSERT INTO user_accounts (name, email, password_hash, account_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, auth_user_id, name, email, account_type, company_name, created_at`,
        [trimmedName, cleanEmail, hashedPassword, validAccountType]
      );

      const dbUser = insertRes.rows[0];

      const newUser = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        accountType: dbUser.account_type,
        companyName: dbUser.company_name || "My Brand",
        authenticatedAt: new Date().toISOString(),
      };

      // Sign cryptographic session token
      const sessionToken = await issueSessionToken(newUser);

      const response = NextResponse.json({
        success: true,
        isNewUser: true,
        user: newUser,
      });

      // Set cryptographically signed, HTTP-only session cookie
      const cookieOpts = getSessionCookieOptions();
      response.cookies.set(cookieOpts.name, sessionToken, cookieOpts);

      return response;
    } catch (dbErr: any) {
      console.error("[Auth Signup Database Error]:", dbErr.message);

      return NextResponse.json(
        { error: "Registration service is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Auth Signup Error]:", error);
    return NextResponse.json(
      { error: "Failed to process sign up" },
      { status: 500 }
    );
  }
}
