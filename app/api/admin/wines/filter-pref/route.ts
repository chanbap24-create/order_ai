// GET/PUT /api/admin/wines/filter-pref - 어드민 와인리스트 '가격대별 최소재고' 필터 설정 저장(계정=어드민).
// admin_settings(key/value)에 저장 → 브라우저/기기 바뀌어도 유지, 새로고침해도 안 리셋.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

const PREF_KEY = "wine_list_min_stock";
const TIERS = ["u20k", "u50k", "u100k", "u200k", "over"] as const;

function sanitize(o: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of TIERS) {
    const v = Math.round(Number(o[k]));
    out[k] = Number.isFinite(v) && v > 0 ? v : 0;
  }
  return out;
}

export async function GET() {
  try {
    const { data } = await supabase.from("admin_settings").select("value").eq("key", PREF_KEY).maybeSingle();
    let minStock: Record<string, number> | null = null;
    if (data?.value) {
      try { minStock = sanitize(JSON.parse(data.value)); } catch { /* ignore */ }
    }
    return NextResponse.json({ minStock });
  } catch (e) {
    return NextResponse.json({ minStock: null, error: String(e) }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.minStock !== "object" || body.minStock === null) {
      return NextResponse.json({ error: "minStock required" }, { status: 400 });
    }
    const minStock = sanitize(body.minStock as Record<string, unknown>);
    const { error } = await supabase.from("admin_settings").upsert(
      { key: PREF_KEY, value: JSON.stringify(minStock), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, minStock });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
