import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getSessionToken, revokeSessionToken } from "@/lib/security/session";
import { rejectCrossOrigin } from "@/lib/security/api-guard";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  try {
    const token = getSessionToken(request);
    if (token) await revokeSessionToken(token);
  } catch {
    return NextResponse.json({ success: false, error: "Logout could not be completed. Please retry." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
