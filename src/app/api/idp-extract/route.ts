import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { checkProcessingBudget } from "@/lib/security/api-guard";
import { executeIDPPipeline } from "@/domain/idp-pipeline";
import { getSessionUserId } from "@/lib/security/session";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const budgetError = checkProcessingBudget(req, userId);
    if (budgetError) return budgetError;
    const body = await readJsonBody(req, 1024 * 1024);
    const { fileName, rawText, customType } = body;

    if (typeof fileName !== "string" || !fileName || fileName.length > 255 ||
        typeof rawText !== "string" || !rawText || rawText.length > 200_000) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: fileName and rawText" },
        { status: 400 }
      );
    }

    const result = await executeIDPPipeline(fileName, rawText, { customType });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json(
      { success: false, error: "Failed to execute IDP extraction." },
      { status: 500 }
    );
  }
}
