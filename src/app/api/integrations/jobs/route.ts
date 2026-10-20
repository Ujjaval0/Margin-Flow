import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const owner = await getSessionUserId(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (!owner) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: "Invalid task identifier." }, { status: 400, headers });
  try {
    const result = await query(`SELECT id,status,result,error_message,updated_at FROM integration_tasks
      WHERE id=$1 AND user_id=$2 LIMIT 1`, [id, owner]);
    if (!result.rows.length) return NextResponse.json({ success: false, error: "Task is unavailable." }, { status: 404, headers });
    const task = result.rows[0];
    return NextResponse.json({ success: true, task: { id: task.id, status: task.status, result: task.result, error: task.error_message, updatedAt: task.updated_at } }, { headers });
  } catch { return NextResponse.json({ success: false, error: "Task status is temporarily unavailable." }, { status: 503, headers }); }
}
