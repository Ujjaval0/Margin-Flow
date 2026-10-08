import { NextRequest, NextResponse } from "next/server";
import { getWebhookSecret } from "@/lib/security/secret-vault";
import { verifyGenericWebhook } from "@/lib/security/webhook-verifier";
import { checkAndMarkEventIdempotency } from "@/lib/security/idempotency";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { GenericOrderWebhookSchema, mapGenericOrderToDomain } from "@/lib/webhooks/schemas/generic-schema";
import { queueManager } from "@/lib/queue/queue-manager";

const MAX_WEBHOOK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. Size Limit
    const contentLength = Number(req.headers.get("content-length")) || 0;
    if (contentLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }

    // 2. Read Raw Buffer
    const arrayBuffer = await req.arrayBuffer();
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
    const webhookId = req.headers.get("X-Webhook-Id") || `gnw_${Date.now()}`;

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
    const secret = getWebhookSecret("generic");
    const verification = verifyGenericWebhook(rawBodyBuffer, signatureHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cryptographic signature." },
        { status: 401 }
      );
    }

    // 5. Check Idempotency
    const idempotency = checkAndMarkEventIdempotency(channelHeader, webhookId);
    if (idempotency.isDuplicate) {
      return NextResponse.json(
        {
          success: true,
          deduplicated: true,
          message: "Event already ingested into ledger.",
          recordedAt: idempotency.recordedAt,
        },
        { status: 200 }
      );
    }

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

    // 8. Enqueue Task
    await queueManager.enqueue("BULK_CSV_IMPORT", {
      type: "GENERIC_WEBHOOK_ORDER",
      channel: channelHeader,
      order: domainOrder,
      webhookId,
    });

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        eventId: webhookId,
        orderId: domainOrder.id,
        channel: domainOrder.marketplace,
        latencyMs: latency,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(formatSafeErrorResponse(err, "Webhook processing error."), {
      status: 500,
    });
  }
}
