import { NextRequest, NextResponse } from "next/server";
import { getBrandById, updateBrand, deleteBrand } from "@/app/lib/brandDb";

// GET /api/admin/brands/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brand = await getBrandById(Number(id));
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }
  return NextResponse.json(brand);
}

// PATCH /api/admin/brands/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const brand = await updateBrand(Number(id), body);
  if (!brand) {
    return NextResponse.json({ error: "Failed to update brand" }, { status: 500 });
  }
  return NextResponse.json(brand);
}

// DELETE /api/admin/brands/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteBrand(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete brand" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
