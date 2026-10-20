import { NextRequest } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingPreferences } from "@/domain/types";

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
  avatarUrl?: string;
  onboardingPreferences?: OnboardingPreferences;
  authenticatedAt?: string;
  workspaceTourPending?: boolean;
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

/** Resolves a live Supabase session to its MarginFlow account ID. */
export async function getSessionUser(req: NextRequest | Request): Promise<SessionPayload | null> {
  try {
    const supabase = await createSupabaseServerClient();
    // Financial access must reject revoked sessions, even while their JWT is unexpired.
    // https://supabase.com/docs/guides/auth/server-side/advanced-guide
    const { data, error } = await supabase.auth.getUser();
    const authUser = data?.user;
    const authUserId = authUser?.id;
    if (!error && authUser && typeof authUserId === "string" && authUserId) {
      const result = await query(
        `SELECT id, name, email, account_type, company_name, phone
         FROM user_accounts
         WHERE auth_user_id = $1
         LIMIT 1`,
        [authUserId]
      );
      if (result.rows.length === 1) {
        const account = result.rows[0];
        const userMetadata = authUser.user_metadata;
        const avatarUrl = userMetadata && typeof userMetadata === "object" && !Array.isArray(userMetadata)
          ? (userMetadata as Record<string, unknown>).avatarUrl
          : undefined;
        // Display preferences only; authorization continues to use the mapped DB account.
        const rawPreferences = userMetadata?.onboardingPreferences;
        let onboardingPreferences: OnboardingPreferences | undefined;
        if (rawPreferences && typeof rawPreferences === "object" && !Array.isArray(rawPreferences)) {
          onboardingPreferences = {};
          for (const key of ["role", "roleLabel", "volume", "completedAt"] as const) {
            if (typeof rawPreferences[key] === "string") onboardingPreferences[key] = rawPreferences[key];
          }
          if (Array.isArray(rawPreferences.channels)) onboardingPreferences.channels = rawPreferences.channels.filter((channel: unknown) => typeof channel === "string");
        }
        const now = Math.floor(Date.now() / 1000);
        return {
          sid: authUserId,
          sub: account.id,
          email: typeof authUser.email === "string" ? authUser.email : account.email,
          name: account.name,
          accountType: account.account_type,
          companyName: account.company_name,
          avatarUrl: typeof avatarUrl === "string" && avatarUrl ? avatarUrl : undefined,
          onboardingPreferences,
          authenticatedAt: typeof authUser.last_sign_in_at === "string" ? authUser.last_sign_in_at : undefined,
          workspaceTourPending: userMetadata?.workspaceTourPending === true && userMetadata?.workspaceTourSeen !== true,
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
