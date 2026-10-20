import { NextResponse } from "next/server";
import { ensureMarginFlowAccount } from "@/lib/auth/supabase-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACCOUNT_TYPES = new Set(["BRAND_OWNER", "SUPPLIER", "WHOLESALER"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("type") === "email" ? url.searchParams.get("token_hash") : null;
  if (!code && !tokenHash) return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));

  let failure = "auth_failed";
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (error) throw error;
    if (!data.user) return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));

    failure = "account_setup_failed";
    const requestedType = url.searchParams.get("accountType");
    const accountType = requestedType && ACCOUNT_TYPES.has(requestedType) ? requestedType : undefined;
    const { isNewUser } = await ensureMarginFlowAccount(data.user, accountType);
    failure = "profile_setup_failed";
    if (isNewUser && data.user.user_metadata?.onboardingPending !== true) {
      const { error: metadataError } = await supabase.auth.updateUser({ data: { onboardingPending: true } });
      if (metadataError) throw metadataError;
    }

    const next = url.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : null;
    const onboardingRequired = !data.user.user_metadata?.onboardingCompleted &&
      (isNewUser || data.user.user_metadata?.onboardingPending === true);
    const redirectPath = safeNext || (onboardingRequired ? "/onboarding" : "/dashboard");
    if (redirectPath === "/login?verified=1") {
      await supabase.auth.signOut();
    }
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    // Log the stage and diagnostic code without credentials, tokens, or account details.
    const code = error && typeof error === "object" && "code" in error &&
      typeof error.code === "string" && /^[a-zA-Z0-9_]{1,64}$/.test(error.code)
      ? error.code : "unknown";
    console.error("[Auth Callback Error]:", { stage: failure, code });
    return NextResponse.redirect(new URL(`/login?error=${failure}`, request.url));
  }
}
