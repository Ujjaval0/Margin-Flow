import { NextRequest, NextResponse } from "next/server";
import { executeIDPPipeline } from "@/domain/idp-pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, rawText, customType } = body;

    if (!fileName || !rawText) {
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
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute IDP extraction." },
      { status: 500 }
    );
  }
}
