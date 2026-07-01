import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

const isAdmin = (r: string) => r === "admin" || r === "executive" || r === "sales_admin";

// 기간별 시음주(is_tasting) 목록 — 결재용. GET ?manager=&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const manager = isAdmin(session.role) ? sp.get("manager") || session.manager : session.manager;
    const start = sp.get("start") || "";
    const end = sp.get("end") || "";

    const status = sp.get("status") || "all"; // all | pending | submitted
    let q = supabase
      .from("saved_quotes")
      .select("id, client_code, client_name, company, created_at, total_supply, items, tasting_submitted_at, doc_settings")
      .eq("is_tasting", true)
      .eq("manager", manager)
      .order("created_at", { ascending: false });
    if (start) q = q.gte("created_at", `${start}T00:00:00+09:00`);
    if (end) q = q.lte("created_at", `${end}T23:59:59+09:00`);
    if (status === "pending") q = q.is("tasting_submitted_at", null);
    else if (status === "submitted") q = q.not("tasting_submitted_at", "is", null);
    const { data, error } = await q;
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = ((data || []) as any[]).map((r) => {
      const items = Array.isArray(r.items) ? r.items : [];
      const it = items[0] || {};
      const ds = r.doc_settings && typeof r.doc_settings === "object" ? r.doc_settings : {};
      const shipDate = /^\d{4}-\d{2}-\d{2}/.test(String(ds.ship_date || "")) ? String(ds.ship_date).slice(0, 10) : String(r.created_at).slice(0, 10);
      return {
        id: Number(r.id),
        client_code: r.client_code || "",
        client_name: r.client_name || "",
        created_at: String(r.created_at),
        ship_date: shipDate, // 출고일(발주 배송일) 우선, 없으면 등록일
        supply: Number(it.supply_price) || 0,
        qty: Number(it.quantity) || 1,
        item_name: String(it.product_name || it.item_code || ""),
        submitted: !!r.tasting_submitted_at,
      };
    });
    return NextResponse.json({ rows, manager });
  } catch (err) {
    console.error("GET /api/sales/tasting/approvals error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// 상신완료/비상신 처리 — PATCH { ids: number[], submitted: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n)) : [];
    if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
    const manager = isAdmin(session.role) ? body.manager || session.manager : session.manager;
    const val = body.submitted ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("saved_quotes")
      .update({ tasting_submitted_at: val })
      .in("id", ids)
      .eq("manager", manager)
      .eq("is_tasting", true);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/sales/tasting/approvals error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
