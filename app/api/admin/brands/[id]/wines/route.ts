import { NextRequest, NextResponse } from "next/server";
import { getWinesByBrandCode, getBrandById } from "@/app/lib/brandDb";

// GET /api/admin/brands/:id/wines — 브랜드에 연결된 와인 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brand = await getBrandById(Number(id));
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }
  if (!brand.brand_code) {
    return NextResponse.json([]);
  }
  const wines = await getWinesByBrandCode(brand.brand_code);
  return NextResponse.json(wines);
}
