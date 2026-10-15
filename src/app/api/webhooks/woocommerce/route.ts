import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes, RequestBodyError } from "@/lib/security/request-body";
import { resolveWebhookConnection } from "@/lib/security/webhook-connection";
import { verifyWooCommerceWebhook } from "@/lib/security/webhook-verifier";
import { persistWebhookOrder } from "@/lib/integrations/webhook-persistence";
import { formatSafeErrorResponse, redactSensitiveData } from "@/lib/security/redactor";
import { WooCommerceOrderWebhookSchema, mapWooCommerceOrderToDomain } from "@/lib/webhooks/schemas/woocommerce-schema";

const MAX_WEBHOOK_SIZE_BYTES = 1024 * 1024; // 1MB

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const connection = await resolveWebhookConnection(req, "woocommerce");
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

    // 3. Extract Headers (Enforce x-wc-webhook-delivery-id per Task 3.2)
    const hmacHeader = req.headers.get("x-wc-webhook-signature");
    const topicHeader = req.headers.get("x-wc-webhook-topic") || "order.created";
    const webhookDeliveryId =
      req.headers.get("x-wc-webhook-delivery-id") ||
      "";
    const sourceHeader = req.headers.get("x-wc-webhook-source") || "woocommerce";

    // 4. Handle WooCommerce Ping events immediately (so WordPress does not disable the webhook)
    if (topicHeader.includes("ping") || topicHeader === "action.woocommerce_webhook_ping") {
      return NextResponse.json(
        {
          success: true,
          message: "WooCommerce webhook handshake ping verified. Endpoint is live.",
          webhookId: webhookDeliveryId,
        },
        { status: 200 }
      );
    }

    // 5. Verify Cryptographic HMAC Signature
    const secret = connection.secret;
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

    // Replay detection is committed atomically with the ledger below.
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

    // 8. Direct PostgreSQL Persistence (eliminates in-memory queue loss)
    if (!webhookDeliveryId) return NextResponse.json({ success: false, error: "Missing webhook delivery ID." }, { status: 400 });
    const receipt = await persistWebhookOrder(connection, webhookDeliveryId, rawBodyBuffer, domainOrder);

    // Acknowledge only after durable ingestion.

    const latency = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json(
      {
        success: true,
        deduplicated: receipt.isDuplicate,
        eventId: webhookDeliveryId,
        orderId: domainOrder.id,
        channel: "WooCommerce",
        latencyMs: latency,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err instanceof RequestBodyError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    return NextResponse.json(formatSafeErrorResponse(err, "WooCommerce processing error."), {
      status: 500,
    });
  }
}
