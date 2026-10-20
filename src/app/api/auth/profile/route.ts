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
const ROLE_LABELS: Record<string, string> = {
  FOUNDER: "Founder / Business Owner",
  STUDENT: "Student",
  OPERATIONS_FINANCE: "E-commerce / Finance Manager",
  SUPPLIER_MANUFACTURER: "Manufacturer / Supplier",
  AGENCY_CONSULTANT: "Agency Owner / Consultant",
};

export async function POST(request: Request) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });

    const body = await readJsonBody(request, 16 * 1024);
    if (body.expectedAccountId !== session.sub) {
      return NextResponse.json({ error: "Your account changed. Reload before editing your profile." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const { name, companyName, phone, businessRole, customRole, avatarUrl } = body;
    const avatarWasProvided = Object.prototype.hasOwnProperty.call(body, "avatarUrl");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }
    if (typeof companyName !== "string" || !companyName.trim() || companyName.trim().length > 200) {
      return NextResponse.json({ error: "Enter a valid company or brand name." }, { status: 400 });
    }
    if (typeof phone !== "string" || phone.length > 10 || (phone && !/^\d{10}$/.test(phone))) {
      return NextResponse.json({ error: "Enter exactly 10 digits for your Indian mobile number, or leave it blank." }, { status: 400 });
    }
    if (typeof businessRole !== "string" || !BUSINESS_ROLES.has(businessRole)) {
      return NextResponse.json({ error: "Choose a valid business role." }, { status: 400 });
    }
    if (businessRole === "OTHER" && (typeof customRole !== "string" || !customRole.trim() || customRole.trim().length > 100)) {
      return NextResponse.json({ error: "Enter your business role." }, { status: 400 });
    }
    if (avatarWasProvided && avatarUrl !== null && typeof avatarUrl !== "string") {
      return NextResponse.json({ error: "Choose a valid profile photo." }, { status: 400 });
    }
    if (typeof avatarUrl === "string" && avatarUrl.length > 2048) {
      return NextResponse.json({ error: "Choose a valid profile photo." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || authData.user.id !== session.sid) {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }

    const currentAvatarUrl = typeof authData.user.user_metadata?.avatarUrl === "string"
      ? authData.user.user_metadata.avatarUrl
      : null;
    if (typeof avatarUrl === "string") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
      const expectedAvatarUrl = `${supabaseUrl}/storage/v1/object/public/profile-avatars/${authData.user.id}/avatar`;
      let parsedAvatarUrl: URL;
      try {
        parsedAvatarUrl = new URL(avatarUrl);
      } catch {
        return NextResponse.json({ error: "Choose a valid profile photo." }, { status: 400 });
      }
      if (`${parsedAvatarUrl.origin}${parsedAvatarUrl.pathname}` !== expectedAvatarUrl || !/^\?v=\d+$/.test(parsedAvatarUrl.search)) {
        return NextResponse.json({ error: "Choose a valid profile photo." }, { status: 400 });
      }
    }

    const roleLabel = businessRole === "OTHER" ? customRole.trim() : ROLE_LABELS[businessRole];
    const preferences = {
      ...(authData.user.user_metadata?.onboardingPreferences || {}),
      role: businessRole,
      roleLabel,
    };

    const saved = await query(
      `UPDATE user_accounts
       SET name = $1, company_name = $2, phone = NULLIF($3, ''), updated_at = NOW()
       WHERE id = $4 AND auth_user_id = $5
       RETURNING id, name, company_name, phone, email`,
      [name.trim(), companyName.trim(), phone.trim(), session.sub, session.sid]
    );
    if (!saved.rows.length) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        onboardingPreferences: preferences,
        ...(avatarWasProvided ? { avatarUrl } : {}),
      },
    });
    if (metadataError) {
      console.error("[Profile Metadata Error]:", metadataError);
      return NextResponse.json({ error: "Profile details could not be fully saved." }, { status: 503 });
    }

    if (avatarWasProvided && avatarUrl === null) {
      const { error: removeError } = await supabase.storage
        .from("profile-avatars")
        .remove([`${authData.user.id}/avatar`]);
      if (removeError) console.warn("[Profile Avatar Cleanup Error]:", removeError.message);
    }

    return NextResponse.json({
      success: true,
      email: authData.user.email,
      user: {
        id: saved.rows[0].id,
        name: saved.rows[0].name,
        companyName: saved.rows[0].company_name,
        phone: saved.rows[0].phone || "",
        email: authData.user.email,
        avatarUrl: avatarWasProvided ? avatarUrl : currentAvatarUrl,
        onboardingPreferences: preferences,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Profile Update Error]:", error);
    return NextResponse.json({ error: "Profile details could not be saved." }, { status: 500 });
  }
}
