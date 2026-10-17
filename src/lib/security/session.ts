import { NextRequest } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: session.ts was imported into a client bundle. Authentication must remain server-side."
  );
}

export interface SessionPayload {
  sid: string;
  sub: string;
  email: string;
  name?: string;
  phone?: string;
  accountType?: string;
  companyName?: string;
  iat: number;
  exp: number;
}

function getInternalServiceUser(req: NextRequest | Request): SessionPayload | null {
  const internalSecret = process.env.INTERNAL_SERVICE_KEY;
  const providedKey = req.headers.get("x-internal-service-key");
  const providedUser = req.headers.get("x-user-id")?.trim();
  if (!internalSecret || internalSecret.trim().length < 32 || !providedKey || !providedUser) return null;

  const expected = Buffer.from(internalSecret);
  const actual = Buffer.from(providedKey);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  const now = Math.floor(Date.now() / 1000);
  return {
    sid: "internal-service",
    sub: providedUser,
    email: "internal-service@marginflow.io",
    accountType: "SYSTEM",
    iat: now,
    exp: now + 3600,
  };
}

/** Resolves the Supabase-verified identity to its MarginFlow account ID. */
export async function getSessionUser(req: NextRequest | Request): Promise<SessionPayload | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const authUserId = claims?.sub;
    if (!error && claims && typeof authUserId === "string" && authUserId) {
      const result = await query(
        `SELECT id, name, email, account_type, company_name, phone
         FROM user_accounts
         WHERE auth_user_id = $1
         LIMIT 1`,
        [authUserId]
      );
      if (result.rows.length === 1) {
        const account = result.rows[0];
        const now = Math.floor(Date.now() / 1000);
        return {
          sid: authUserId,
          sub: account.id,
          email: typeof claims.email === "string" ? claims.email : account.email,
          name: account.name,
          accountType: account.account_type,
          companyName: account.company_name,
          phone: account.phone || "",
          iat: now,
          exp: now + 3600,
        };
      }
    }
  } catch {
    // Missing Supabase configuration, invalid sessions, and DB outages fail closed.
  }

  return getInternalServiceUser(req);
}

export async function getSessionUserId(req: NextRequest | Request): Promise<string | null> {
  return (await getSessionUser(req))?.sub ?? null;
}
