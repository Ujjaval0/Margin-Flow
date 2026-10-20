import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { getConnectionById, updateSyncStatus } from "@/lib/security/marketplace-vault";
import { marketplaceError } from "./error-response";
import { enqueueStoreSync, dispatchIntegrationTasks } from "./task-queue";

/** HTTP authentication stays outside provider services, so workers never forge merchant sessions. */
export async function integrationRoute(request: Request, platform: string,
  operation: (userId: string, body: Record<string, any>) => Promise<Response>, defaultAction: string) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const userId = await getSessionUserId(request);
  if (!userId) return marketplaceError(platform, "AUTHENTICATION_REQUIRED", "Sign in to manage your store connection.", 401);
  try {
    const body = await readJsonBody(request, 32 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestBodyError("Invalid request body.", 400);
    const action = body.action || defaultAction;
    if (action !== "test_connection" && action !== defaultAction) throw new RequestBodyError("Unsupported store operation.", 400);
    if (body.connectionId && (typeof body.connectionId !== "string" || !/^conn_[\w-]{1,80}$/.test(body.connectionId))) throw new RequestBodyError("Invalid connection identifier.", 400);
    if (body.connectionId) {
      const connection = await getConnectionById(userId, body.connectionId);
      if (!connection || connection.marketplace !== platform) return marketplaceError(platform, "CONNECTION_UNAVAILABLE", "Store connection is unavailable.", 404);
    }
    if (action !== "test_connection" && !body.connectionId) throw new RequestBodyError("Save and verify the store before synchronizing.", 400);
    if (body.background && action === "fetch_orders") {
      if (!body.connectionId) throw new RequestBodyError("Save and verify the store before synchronizing.", 400);
      const taskId = await enqueueStoreSync(userId, body.connectionId);
      dispatchIntegrationTasks(userId, body.connectionId);
      return NextResponse.json({ success: true, queued: true, taskId }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
    }
    // Internal verification flags can never be supplied by a browser.
    const operationBody = body.connectionId ? { action, connectionId: body.connectionId } : { ...body, action };
    const response = await operation(userId, { ...operationBody, verificationOnly: false, syncWindowStart: undefined, syncWindowEnd: undefined, reconciliation: false });
    if (body.connectionId && (response.status === 401 || response.status === 403)) {
      await updateSyncStatus(userId, platform, "REAUTH_REQUIRED", { connectionId: body.connectionId, errorMessage: "Platform authorization expired or was revoked. Reconnect the store." });
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof RequestBodyError ? error.message : "Store operation could not be completed." },
      { status: error instanceof RequestBodyError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
