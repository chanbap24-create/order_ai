// app/api/admin/price-list/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePriceListExcel } from "@/app/lib/priceListExcel";
import { logChange } from "@/app/lib/changeLogDb";
import { handleApiError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const version = (url.searchParams.get('version') || 'highlight') as 'highlight' | 'clean';

    const buffer = await generatePriceListExcel(version);

    logChange('price_list_exported', 'price_list', version, {});

    const filename = `CavedeVin-PriceList-${version}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
