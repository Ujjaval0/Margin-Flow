import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/session";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { query } from "@/lib/db";

const BUSINESS_ROLES = new Set([
  "FOUNDER",
  "STUDENT",
  "OPERATIONS_FINANCE",
  "SUPPLIER_MANUFACTURER",
  "AGENCY_CONSULTANT",
  "OTHER",
]);
const ORDER_VOLUMES = new Set(["STARTER", "GROWTH", "SCALE", "ENTERPRISE"]);
const BUSINESS_ROLE_LABELS: Record<string, string> = {
  FOUNDER: "Founder / Business Owner",
  STUDENT: "Student",
  OPERATIONS_FINANCE: "E-commerce / Finance Manager",
  SUPPLIER_MANUFACTURER: "Manufacturer / Supplier",
  AGENCY_CONSULTANT: "Agency Owner / Consultant",
};

export async function POST(request: Request) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ error: "Sign in to save your onboarding details." }, { status: 401 });
    }

    const body = await readJsonBody(request, 16 * 1024);
    const { brandName, phone, businessRole, customBusinessRole, orderVolume } = body;
    if (typeof brandName !== "string" || !brandName.trim() || brandName.trim().length > 200) {
      return NextResponse.json({ error: "Enter a brand or company name." }, { status: 400 });
    }
    if (typeof phone !== "string" || phone.length > 40) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (typeof businessRole !== "string" || !BUSINESS_ROLES.has(businessRole)) {
      return NextResponse.json({ error: "Choose your business role." }, { status: 400 });
    }
    if (businessRole === "OTHER" && (typeof customBusinessRole !== "string" || !customBusinessRole.trim() || customBusinessRole.trim().length > 100)) {
      return NextResponse.json({ error: "Enter your role." }, { status: 400 });
    }
    if (!/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: "Enter exactly 10 digits for your Indian mobile number." }, { status: 400 });
    }
    if (typeof orderVolume !== "string" || !ORDER_VOLUMES.has(orderVolume)) {
      return NextResponse.json({ error: "Choose your monthly order volume." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || authData.user.id !== session.sid) {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }

    const completedAt = new Date().toISOString();
    const onboardingPreferences = {
      role: businessRole,
      roleLabel: businessRole === "OTHER" ? customBusinessRole.trim() : BUSINESS_ROLE_LABELS[businessRole],
      volume: orderVolume,
      completedAt,
    };

    const saved = await query(
      `UPDATE user_accounts
       SET company_name = $1, phone = NULLIF($2, ''), updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [brandName.trim(), phone.trim(), session.sub]
    );
    if (saved.rowCount !== 1) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        onboardingCompleted: true,
        onboardingPending: false,
        onboardingPreferences,
        // Queue the workspace introduction only on the first completed onboarding.
        ...(authData.user.user_metadata?.onboardingCompleted !== true && authData.user.user_metadata?.workspaceTourSeen !== true
          ? { workspaceTourPending: true }
          : {}),
      },
    });
    if (metadataError) {
      console.error("[Onboarding Metadata Error]:", metadataError);
      return NextResponse.json({ error: "Could not finish saving your onboarding details." }, { status: 503 });
    }

    return NextResponse.json({ success: true, onboardingPreferences });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Onboarding Save Error]:", error);
    return NextResponse.json({ error: "Could not save your onboarding details." }, { status: 500 });
  }
}
