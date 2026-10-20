import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/session";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);

  if (!session) {
    return NextResponse.json(
      { authenticated: false, error: "No valid session found" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (session.sid !== "internal-service") {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        accountType: session.accountType,
        companyName: session.companyName || "My Brand",
        phone: session.phone || "",
        avatarUrl: session.avatarUrl || null,
        workspaceTourPending: session.workspaceTourPending === true,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const res = await query(
      `SELECT id, auth_user_id, name, email, account_type, company_name, phone, created_at
       FROM user_accounts
       WHERE id = $1
       LIMIT 1`,
      [session.sub]
    );

    if (res.rows.length > 0) {
      const dbUser = res.rows[0];
      return NextResponse.json({
        authenticated: true,
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          accountType: dbUser.account_type,
          companyName: dbUser.company_name || "My Brand",
          phone: dbUser.phone || "",
          avatarUrl: null,
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ authenticated: false, error: "Account not found." }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false, error: "Identity service unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
