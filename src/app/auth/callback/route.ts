import { NextResponse } from "next/server";
import { ensureMarginFlowAccount } from "@/lib/auth/supabase-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACCOUNT_TYPES = new Set(["BRAND_OWNER", "SUPPLIER", "WHOLESALER"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return NextResponse.redirect(new URL("/login", request.url));

    const requestedType = url.searchParams.get("accountType");
    const accountType = requestedType && ACCOUNT_TYPES.has(requestedType) ? requestedType : undefined;
    const { isNewUser } = await ensureMarginFlowAccount(data.user, accountType);
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
    console.error("[Auth Callback Error]:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
