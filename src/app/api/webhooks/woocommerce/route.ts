import { NextRequest, NextResponse } from "next/server";
import { getWebhookSecret } from "@/lib/security/secret-vault";
import { verifyWooCommerceWebhook } from "@/lib/security/webhook-verifier";
import { checkAndMarkEventIdempotency } from "@/lib/security/idempotency";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { WooCommerceOrderWebhookSchema, mapWooCommerceOrderToDomain } from "@/lib/webhooks/schemas/woocommerce-schema";
import { queueManager } from "@/lib/queue/queue-manager";

const MAX_WEBHOOK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. Enforce Payload Size Limit
    const contentLength = Number(req.headers.get("content-length")) || 0;
    if (contentLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }

    // 2. Read Raw Byte Stream
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }
    const rawBodyBuffer = Buffer.from(arrayBuffer);

    // 3. Extract Headers
    const hmacHeader = req.headers.get("x-wc-webhook-signature");
    const topicHeader = req.headers.get("x-wc-webhook-topic") || "order.created";
    const webhookIdHeader = req.headers.get("x-wc-webhook-id") || `wcw_${Date.now()}`;
    const sourceHeader = req.headers.get("x-wc-webhook-source") || "woocommerce";

    // 4. Handle WooCommerce Ping events immediately (so WordPress does not disable the webhook)
    if (topicHeader.includes("ping") || topicHeader === "action.woocommerce_webhook_ping") {
      return NextResponse.json(
        {
          success: true,
          message: "WooCommerce webhook handshake ping verified. Endpoint is live.",
          webhookId: webhookIdHeader,
        },
        { status: 200 }
      );
    }

    // 5. Verify Cryptographic HMAC Signature
    const secret = getWebhookSecret("woocommerce");
    const verification = verifyWooCommerceWebhook(rawBodyBuffer, hmacHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid WooCommerce HMAC signature. Ensure WOOCOMMERCE_WEBHOOK_SECRET matches the Secret entered in WooCommerce.",
        },
        { status: 401 }
      );
    }

    // 5. Check Idempotency (Replay Defense)
    const idempotency = checkAndMarkEventIdempotency("woocommerce", webhookIdHeader);
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

    // 6. Strict Zod Schema Parsing
    const rawJson = JSON.parse(rawBodyBuffer.toString("utf-8"));
    const parseResult = WooCommerceOrderWebhookSchema.safeParse(rawJson);

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

    // 7. Map to Canonical Domain Model
    const domainOrder = mapWooCommerceOrderToDomain(parseResult.data);

    // 8. Enqueue to Background Processing
    await queueManager.enqueue("BULK_CSV_IMPORT", {
      type: "WOOCOMMERCE_WEBHOOK_ORDER",
      topic: topicHeader,
      source: sourceHeader,
      order: domainOrder,
      webhookId: webhookIdHeader,
    });

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        eventId: webhookIdHeader,
        orderId: domainOrder.id,
        channel: "WooCommerce",
        latencyMs: latency,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(formatSafeErrorResponse(err, "WooCommerce processing error."), {
      status: 500,
    });
  }
}
