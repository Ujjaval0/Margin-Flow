import { NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkAuthBudget } from "@/lib/security/api-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureMarginFlowAccount } from "@/lib/auth/supabase-account";

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

    if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
      return NextResponse.json(
        { error: "Password must contain at least 8 characters" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
    const emailRedirectUrl = new URL("/auth/callback", siteUrl);
    emailRedirectUrl.searchParams.set("next", "/login?verified=1");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: trimmedName, accountType },
        emailRedirectTo: emailRedirectUrl.toString(),
      },
    });

    if (error) {
      const isDuplicate = /already registered|already been registered/i.test(error.message);
      return NextResponse.json(
        { error: isDuplicate ? "An account with this email already exists. Please sign in." : error.message },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    if (data.session && data.user) {
      const { account, isNewUser } = await ensureMarginFlowAccount(data.user, accountType);
      if (isNewUser && data.user.user_metadata?.onboardingPending !== true) {
        const { error: metadataError } = await supabase.auth.updateUser({ data: { onboardingPending: true } });
        if (metadataError) throw metadataError;
      }
      return NextResponse.json({
        success: true,
        onboardingRequired: isNewUser || data.user.user_metadata?.onboardingPending === true,
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          accountType: account.account_type,
          companyName: account.company_name || "My Brand",
        },
      });
    }

    return NextResponse.json({
      success: true,
      confirmationRequired: true,
      message: "Check your email and confirm your address to finish creating your account.",
    });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[Auth Signup Error]:", error);
    return NextResponse.json(
      { error: "Failed to process sign up" },
      { status: 500 }
    );
  }
}
