import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue/queue-manager";
import { JobType } from "@/lib/queue/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, payload, options } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: "Field 'type' is required." },
        { status: 400 }
      );
    }

    const job = await queueManager.enqueue(type as JobType, payload || {}, options);

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to enqueue background job." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as any;
  const type = searchParams.get("type") as any;

  const jobs = queueManager.listJobs({ status, type });
  return NextResponse.json({
    success: true,
    data: jobs,
  });
}
