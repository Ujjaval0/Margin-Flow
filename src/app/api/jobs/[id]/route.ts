import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/queue-manager";
import { getSessionUserId } from "@/lib/security/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const ownerId = await getSessionUserId(req);
  if (!ownerId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const job = await queueManager.getJob(id, ownerId);

  if (!job) {
    return NextResponse.json(
      { success: false, error: `Job with ID '${id}' not found.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: job,
  });
  } catch {
    return NextResponse.json({ success: false, error: "Background processing is temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const ownerId = await getSessionUserId(req);
  if (!ownerId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const cancelled = await queueManager.cancelJob(id, ownerId);
  if (!cancelled) return NextResponse.json({ success: false, error: "Job not found or no longer cancellable." }, { status: 404 });

  return NextResponse.json({
    success: true,
    message: "Job cancelled successfully.",
  });
  } catch {
    return NextResponse.json({ success: false, error: "Background processing is temporarily unavailable." }, { status: 503 });
  }
}
