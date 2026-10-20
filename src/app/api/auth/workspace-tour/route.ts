import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/security/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Claim the introduction before displaying it so a later sign-in does not replay it.
export async function POST(request: Request) {
  const session = await getSessionUser(request);
  if (!session || session.sid === "internal-service") {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== session.sid) {
      return NextResponse.json({ error: "Your session expired." }, { status: 401 });
    }
    const metadata = data.user.user_metadata;
    if (metadata?.workspaceTourPending !== true || metadata?.workspaceTourSeen === true) {
      return NextResponse.json({ showTour: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const { error: saveError } = await supabase.auth.updateUser({
      data: { workspaceTourPending: false, workspaceTourSeen: true },
    });
    if (saveError) {
      return NextResponse.json({ error: "Could not save tour progress." }, { status: 503 });
    }
    return NextResponse.json({ showTour: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save tour progress." }, { status: 503 });
  }
}
