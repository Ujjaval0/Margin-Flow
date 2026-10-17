import { NextRequest, NextResponse } from "next/server";
import { queueManager, QueueUnavailableError, JobProcessorUnavailableError } from "@/lib/queue/queue-manager";
import "@/lib/queue/job-processors";
import { JobType } from "@/lib/queue/types";
import { getSessionUserId } from "@/lib/security/session";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkProcessingBudget } from "@/lib/security/api-guard";

export async function POST(req: NextRequest) {
  try {
    const ownerId = await getSessionUserId(req);
    if (!ownerId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    if (!queueManager.isWorkerEnabled()) return NextResponse.json({ success: false, error: "Background processing is temporarily unavailable." }, { status: 503 });
    const budgetError = checkProcessingBudget(req, ownerId);
    if (budgetError) return budgetError;
    const body = await readJsonBody(req);
    const { type, payload, options } = body;

    if (!["BULK_CSV_IMPORT", "RECONCILE_SETTLEMENTS", "GENERATE_FINANCIAL_REPORT", "PROCESS_BATCH_IDP"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Field 'type' is required." },
        { status: 400 }
      );
    }

    const job = await queueManager.enqueue(type as JobType, payload || {}, {
      ownerId,
      delayMs: Math.min(60_000, Math.max(0, Number(options?.delayMs) || 0)),
      maxAttempts: options?.maxAttempts,
      priority: options?.priority,
      idempotencyKey: req.headers.get("idempotency-key") || options?.idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    if (error instanceof QueueUnavailableError) return NextResponse.json({ success: false, error: "Background processing is temporarily unavailable." }, { status: 503 });
    if (error instanceof JobProcessorUnavailableError) return NextResponse.json({ success: false, error: "This background job type is not available yet." }, { status: 503 });
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json(
      { success: false, error: "Failed to enqueue background job." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
  const ownerId = await getSessionUserId(req);
  if (!ownerId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as any;
  const type = searchParams.get("type") as any;

  const validStatuses = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"];
  const validTypes = ["BULK_CSV_IMPORT", "RECONCILE_SETTLEMENTS", "GENERATE_FINANCIAL_REPORT", "PROCESS_BATCH_IDP"];
  if ((status && !validStatuses.includes(status)) || (type && !validTypes.includes(type))) {
    return NextResponse.json({ success: false, error: "Invalid job filter." }, { status: 400 });
  }
  const jobs = await queueManager.listJobs({ status, type, ownerId });
  return NextResponse.json({
    success: true,
    data: jobs,
  });
  } catch {
    return NextResponse.json({ success: false, error: "Background processing is temporarily unavailable." }, { status: 503 });
  }
}
