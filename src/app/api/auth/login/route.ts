import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureMarginFlowAccount } from "@/lib/auth/supabase-account";

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

    const supabase = await createSupabaseServerClient();
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

    const { account, isNewUser } = await ensureMarginFlowAccount(data.user);
    if (isNewUser && data.user.user_metadata?.onboardingPending !== true) {
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
    console.error("[Auth Login Error]:", error);
    return NextResponse.json(
      { error: "Failed to process login" },
      { status: 500 }
    );
  }
}
