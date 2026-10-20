import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes, RequestBodyError } from "@/lib/security/request-body";
import { resolveWebhookConnection } from "@/lib/security/webhook-connection";
import { verifyShopifyWebhook } from "@/lib/security/webhook-verifier";
import { enqueueWebhook } from "@/lib/integrations/task-queue";
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
    const webhookIdHeader = req.headers.get("X-Shopify-Webhook-Id") || "";
    const shopDomain = req.headers.get("X-Shopify-Shop-Domain")?.toLowerCase();
    if (!connection.shopDomain || shopDomain !== connection.shopDomain.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Webhook shop does not match its registered store." }, { status: 401 });
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

    // 8. Commit the authenticated delivery to the encrypted durable queue.
    if (!webhookIdHeader) return NextResponse.json({ success: false, error: "Missing webhook delivery ID." }, { status: 400 });
    const receipt = await enqueueWebhook(connection, webhookIdHeader, rawBodyBuffer, domainOrder);

    // Acknowledge only after an encrypted receipt is durable; the worker posts the ledger.

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

export async function GET(req: NextRequest) {
  const connection = await resolveWebhookConnection(req, "shopify");
  return NextResponse.json({ success: Boolean(connection?.secret), message: connection?.secret ? "Registered webhook endpoint is reachable." : "Save a signing secret for this connection." },
    { status: connection?.secret ? 200 : 401, headers: { "Cache-Control": "private, no-store" } });
}
