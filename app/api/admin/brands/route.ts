import { NextRequest, NextResponse } from "next/server";
import { getBrands, createBrand } from "@/app/lib/brandDb";

// GET /api/admin/brands — 목록 조회
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const country = url.searchParams.get("country") || undefined;

  const brands = await getBrands({ search, country });
  return NextResponse.json(brands);
}

// POST /api/admin/brands — 생성
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.brand_name_kr) {
    return NextResponse.json({ error: "brand_name_kr is required" }, { status: 400 });
  }

  const brand = await createBrand(body);
  if (!brand) {
    return NextResponse.json({ error: "Failed to create brand" }, { status: 500 });
  }
  return NextResponse.json(brand, { status: 201 });
}
