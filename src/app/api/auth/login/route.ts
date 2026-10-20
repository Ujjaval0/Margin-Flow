import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureMarginFlowAccount } from "@/lib/auth/supabase-account";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

export async function POST(request: Request) {
  let stage = "request";
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

    stage = "configuration";
    const supabase = await createSupabaseServerClient();
    stage = "authenticate";
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    stage = "account_setup";
    const { account, isNewUser } = await ensureMarginFlowAccount(data.user);
    if (isNewUser && data.user.user_metadata?.onboardingPending !== true) {
      stage = "profile_setup";
      const { error: metadataError } = await supabase.auth.updateUser({ data: { onboardingPending: true } });
      if (metadataError) throw metadataError;
    }
    return NextResponse.json({
      success: true,
      onboardingRequired: !data.user.user_metadata?.onboardingCompleted &&
        (isNewUser || data.user.user_metadata?.onboardingPending === true),
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        accountType: account.account_type,
        companyName: account.company_name || "My Brand",
      },
    });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = typeof error?.code === "string" && /^[a-zA-Z0-9_]{1,64}$/.test(error.code) ? error.code : "unknown";
    console.error("[Auth Login Error]:", { stage, code });
    if (error instanceof SupabaseConfigurationError) {
      return NextResponse.json({ error: error.message, code: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { error: "Failed to process login" },
      { status: 500 }
    );
  }
}
