import { NextRequest, NextResponse } from "next/server";
import { getWebhookSecret } from "@/lib/security/secret-vault";
import { verifyShopifyWebhook, verifyTimestampFreshness } from "@/lib/security/webhook-verifier";
import { checkAndMarkEventIdempotency } from "@/lib/security/idempotency";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { ShopifyOrderWebhookSchema, mapShopifyOrderToDomain } from "@/lib/webhooks/schemas/shopify-schema";
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
    const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
    const topicHeader = req.headers.get("X-Shopify-Topic") || "orders/create";
    const webhookIdHeader = req.headers.get("X-Shopify-Webhook-Id") || `shpw_${Date.now()}`;
    const shopDomain = req.headers.get("X-Shopify-Shop-Domain") || "direct";

    // 4. Verify Cryptographic HMAC Signature
    const secret = getWebhookSecret("shopify");
    const verification = verifyShopifyWebhook(rawBodyBuffer, hmacHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cryptographic HMAC signature." },
        { status: 401 }
      );
    }

    // 5. Check Idempotency (Replay Defense)
    const idempotency = checkAndMarkEventIdempotency("shopify", webhookIdHeader);
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
    const parseResult = ShopifyOrderWebhookSchema.safeParse(rawJson);

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
    const domainOrder = mapShopifyOrderToDomain(parseResult.data);

    // 8. Enqueue to Background Processing (< 20ms response time)
    await queueManager.enqueue("BULK_CSV_IMPORT", {
      type: "SHOPIFY_WEBHOOK_ORDER",
      topic: topicHeader,
      shopDomain,
      order: domainOrder,
      webhookId: webhookIdHeader,
    });

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        eventId: webhookIdHeader,
        orderId: domainOrder.id,
        channel: "Shopify",
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
