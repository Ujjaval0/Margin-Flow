import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes, RequestBodyError } from "@/lib/security/request-body";
import { resolveWebhookConnection } from "@/lib/security/webhook-connection";
import { verifyGenericWebhook } from "@/lib/security/webhook-verifier";
import { persistWebhookOrder } from "@/lib/integrations/webhook-persistence";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { GenericOrderWebhookSchema, mapGenericOrderToDomain } from "@/lib/webhooks/schemas/generic-schema";

const MAX_WEBHOOK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const connection = await resolveWebhookConnection(req, "generic");
    if (!connection) return NextResponse.json({ success: false, error: "A registered webhook connection is required." }, { status: 401 });
    // 1. Size Limit
    const contentLength = Number(req.headers.get("content-length")) || 0;
    if (contentLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }

    // 2. Read Raw Buffer
    const arrayBuffer = await readRequestBytes(req, MAX_WEBHOOK_SIZE_BYTES);
    if (arrayBuffer.byteLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }
    const rawBodyBuffer = Buffer.from(arrayBuffer);

    // 3. Extract Headers
    const signatureHeader =
      req.headers.get("X-MarginFlow-Signature") ||
      req.headers.get("x-signature-sha256") ||
      req.headers.get("x-amz-signature");
    const channelHeader = req.headers.get("X-MarginFlow-Channel") || "generic";
    const webhookId = req.headers.get("X-Webhook-Id") || "";

    // 4. Handle Generic Webhook Ping events immediately
    const rawString = rawBodyBuffer.toString("utf-8");
    if (channelHeader.includes("ping") || rawString.includes('"ping":true') || rawString.includes('"ping": true')) {
      return NextResponse.json(
        {
          success: true,
          message: "Generic webhook receiver verified. Endpoint is live.",
          webhookId,
        },
        { status: 200 }
      );
    }

    // 5. Verify HMAC Signature
    const secret = connection.secret;
    const verification = verifyGenericWebhook(rawBodyBuffer, signatureHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cryptographic signature." },
        { status: 401 }
      );
    }

    // Replay detection is committed atomically with the ledger below.
    // 6. Parse Schema
    const rawJson = JSON.parse(rawBodyBuffer.toString("utf-8"));
    const parseResult = GenericOrderWebhookSchema.safeParse(rawJson);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload schema validation failed.",
          details: redactSensitiveData(parseResult.error.format()),
        },
        { status: 422 }
      );
    }

    // 7. Convert to Domain Order
    const domainOrder = mapGenericOrderToDomain(parseResult.data);
    if (!webhookId) return NextResponse.json({ success: false, error: "Missing webhook delivery ID." }, { status: 400 });
    const receipt = await persistWebhookOrder(connection, webhookId, rawBodyBuffer, domainOrder);

    // Acknowledge only after durable ingestion.

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        deduplicated: receipt.isDuplicate,
        eventId: webhookId,
        orderId: domainOrder.id,
        channel: domainOrder.marketplace,
        latencyMs: latency,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof RequestBodyError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    return NextResponse.json(formatSafeErrorResponse(err, "Webhook processing error."), {
      status: 500,
    });
  }
}
