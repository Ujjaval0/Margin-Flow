import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    return NextResponse.json({ success: false, error: "Logout could not be completed. Please retry." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
