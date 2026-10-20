import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { getConnectionById, getConnectionsForUser, disconnectConnection } from "@/lib/security/marketplace-vault";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { verifyAndSaveConnection } from "@/lib/integrations/connection-service";
import { ConnectionInputError } from "@/lib/integrations/connection-input";

const headers = { "Cache-Control": "private, no-store" };
export const maxDuration = 120;

export async function GET(request: Request) {
  const userId = await getSessionUserId(request);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
  try { return NextResponse.json({ success: true, connections: await getConnectionsForUser(userId) }, { headers }); }
  catch { return NextResponse.json({ success: false, error: "Saved connections are temporarily unavailable." }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const userId = await getSessionUserId(request);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
  try {
    const body = await readJsonBody(request, 32 * 1024);
    const connection = await verifyAndSaveConnection(userId, body);
    return NextResponse.json({ success: true, message: "Verified credentials securely saved.", connection }, { headers });
  } catch (error) {
    const known = error instanceof ConnectionInputError || error instanceof RequestBodyError;
    return NextResponse.json({ success: false, error: known ? error.message : "Credentials could not be saved. Check the server vault configuration and retry." },
      { status: error instanceof RequestBodyError ? error.status : known ? 400 : 503, headers });
  }
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const userId = await getSessionUserId(request);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
  try {
    const body = await readJsonBody(request, 4096);
    if (typeof body.connectionId !== "string") throw new ConnectionInputError("Select a saved connection.");
    const connection = await getConnectionById(userId, body.connectionId);
    if (!connection) return NextResponse.json({ success: false, error: "Store connection is unavailable." }, { status: 404, headers });
    await disconnectConnection(userId, connection.marketplace, undefined, connection.id);
    return NextResponse.json({ success: true, message: "Connection disconnected and stored credentials removed." }, { headers });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof ConnectionInputError ? error.message : "Could not disconnect the store." }, { status: 400, headers });
  }
}
