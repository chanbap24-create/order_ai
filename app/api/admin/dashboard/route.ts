// app/api/admin/dashboard/route.ts
import { NextResponse } from "next/server";
import { getWineStats } from "@/app/lib/wineDb";
import { getRecentChanges } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export async function GET() {
  try {
    const stats = await getWineStats();
    const recentChanges = await getRecentChanges(10);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        recentChanges,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
