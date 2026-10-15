import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes, RequestBodyError } from "@/lib/security/request-body";
import { resolveWebhookConnection } from "@/lib/security/webhook-connection";
import { verifyShopifyWebhook, verifyTimestampFreshness } from "@/lib/security/webhook-verifier";
import { persistWebhookOrder } from "@/lib/integrations/webhook-persistence";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { ShopifyOrderWebhookSchema, mapShopifyOrderToDomain } from "@/lib/webhooks/schemas/shopify-schema";

const MAX_WEBHOOK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const connection = await resolveWebhookConnection(req, "shopify");
    if (!connection) return NextResponse.json({ success: false, error: "A registered webhook connection is required." }, { status: 401 });
    // 1. Enforce Payload Size Limit
    const contentLength = Number(req.headers.get("content-length")) || 0;
    if (contentLength > MAX_WEBHOOK_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload exceeds 1MB threshold." },
        { status: 413 }
      );
    }

    // 2. Read Raw Byte Stream
    const arrayBuffer = await readRequestBytes(req, MAX_WEBHOOK_SIZE_BYTES);
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
    const webhookIdHeader = req.headers.get("X-Shopify-Webhook-Id") || "";
    const shopDomain = req.headers.get("X-Shopify-Shop-Domain") || "direct";

    // 4. Handle Shopify Ping events immediately
    const rawString = rawBodyBuffer.toString("utf-8");
    if (topicHeader.includes("ping") || rawString.includes('"ping":true') || rawString.includes('"ping": true')) {
      return NextResponse.json(
        {
          success: true,
          message: "Shopify webhook handshake ping verified. Endpoint is live.",
          webhookId: webhookIdHeader,
        },
        { status: 200 }
      );
    }

    // 5. Verify Cryptographic HMAC Signature
    const secret = connection.secret;
    const verification = verifyShopifyWebhook(rawBodyBuffer, hmacHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cryptographic HMAC signature." },
        { status: 401 }
      );
    }

    // Replay detection is committed atomically with the ledger below.
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

    // 8. Direct PostgreSQL Persistence (eliminates in-memory queue loss)
    if (!webhookIdHeader) return NextResponse.json({ success: false, error: "Missing webhook delivery ID." }, { status: 400 });
    const receipt = await persistWebhookOrder(connection, webhookIdHeader, rawBodyBuffer, domainOrder);

    // Acknowledge only after durable ingestion.

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        deduplicated: receipt.isDuplicate,
        eventId: webhookIdHeader,
        orderId: domainOrder.id,
        channel: "Shopify",
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
