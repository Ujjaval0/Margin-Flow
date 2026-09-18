import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/queue-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = queueManager.getJob(id);

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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cancelled = queueManager.cancelJob(id);

  return NextResponse.json({
    success: cancelled,
    message: cancelled ? "Job cancelled successfully." : "Job could not be cancelled or does not exist.",
  });
}
