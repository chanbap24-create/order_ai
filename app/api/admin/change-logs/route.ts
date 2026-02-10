// app/api/admin/change-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getChangeLogs } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const action = url.searchParams.get('action') || undefined;
    const entityType = url.searchParams.get('entityType') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;

    const result = getChangeLogs(page, limit, { action, entityType, entityId });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
