import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { getTastingLedger, parseKey, type Company } from "@/app/lib/tasting/tastingLedger";

const asCompany = (v: string | null): Company => (v === "DL" ? "DL" : "CDV");
const isAdmin = (role: string) => role === "admin" || role === "executive" || role === "sales_admin";

// 시음주 원장(현황/결재 공용). GET ?company=CDV&start&end&manager=
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const company = asCompany(sp.get("company"));
    const start = sp.get("start") || "";
    const end = sp.get("end") || "";
    if (!start || !end) return NextResponse.json({ error: "기간이 필요합니다." }, { status: 400 });
    // 비관리자는 본인 출고건만. 관리자는 담당자 지정 시 해당자, 없으면 전체.
    const reqManager = sp.get("manager") || "";
    const managers = isAdmin(session.role)
      ? (reqManager ? [reqManager] : null)
      : [session.manager];
    const rows = await getTastingLedger({ company, start, end, managers });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("GET /api/sales/tasting/ledger error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// 상신 처리 — PATCH { company, keys: string[], submitted: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const company = body.company === "DL" ? "DL" : "CDV";
    const keys: string[] = Array.isArray(body.keys) ? body.keys : [];
    const submitted = !!body.submitted;
    const parsed = keys.map(parseKey).filter((x): x is NonNullable<typeof x> => !!x);
    if (parsed.length === 0) return NextResponse.json({ error: "keys required" }, { status: 400 });

    if (submitted) {
      const rows = parsed.map((p) => ({ ...p, company, submitted_by: session.manager }));
      const { error } = await supabase.from("tasting_submissions").upsert(rows, {
        onConflict: "company,ship_date,client_code,item_no",
      });
      if (error) throw error;
    } else {
      // 개별 삭제(복합키 delete는 or 조합으로)
      for (const p of parsed) {
        const { error } = await supabase.from("tasting_submissions").delete()
          .eq("company", company).eq("ship_date", p.ship_date)
          .eq("client_code", p.client_code).eq("item_no", p.item_no);
        if (error) throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/sales/tasting/ledger error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
