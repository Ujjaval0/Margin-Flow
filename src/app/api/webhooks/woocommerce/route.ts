import { NextRequest, NextResponse } from "next/server";
import { readRequestBytes, RequestBodyError } from "@/lib/security/request-body";
import { resolveWebhookConnection } from "@/lib/security/webhook-connection";
import { verifyWooCommerceWebhook } from "@/lib/security/webhook-verifier";
import { enqueueWebhook } from "@/lib/integrations/task-queue";
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
    const webhookDeliveryId =
      req.headers.get("x-wc-webhook-delivery-id") ||
      "";

    // WooCommerce's native registration probe is a form body without an event signature.
    const probe = new URLSearchParams(rawBodyBuffer.toString("utf8"));
    if (!hmacHeader && req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")
      && rawBodyBuffer.length < 100 && Array.from(probe.keys()).length === 1 && /^\d+$/.test(probe.get("webhook_id") || "")) {
      return NextResponse.json({ success: true, message: "Webhook delivery URL is reachable." });
    }

    // 5. Verify Cryptographic HMAC Signature
    const secret = connection.secret;
    const verification = verifyWooCommerceWebhook(rawBodyBuffer, hmacHeader, secret);

    if (!verification.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid WooCommerce HMAC signature. Match this connection's saved signing secret with the Secret in WooCommerce.",
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

    // 8. Commit the authenticated delivery to the encrypted durable queue.
    if (!webhookDeliveryId) return NextResponse.json({ success: false, error: "Missing webhook delivery ID." }, { status: 400 });
    const receipt = await enqueueWebhook(connection, webhookDeliveryId, rawBodyBuffer, domainOrder);

    // Acknowledge only after an encrypted receipt is durable; the worker posts the ledger.

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

export async function GET(req: NextRequest) {
  const connection = await resolveWebhookConnection(req, "woocommerce");
  return NextResponse.json({ success: Boolean(connection?.secret), message: connection?.secret ? "Registered webhook endpoint is reachable." : "Save a signing secret for this connection." },
    { status: connection?.secret ? 200 : 401, headers: { "Cache-Control": "private, no-store" } });
}
