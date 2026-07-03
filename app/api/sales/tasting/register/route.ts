import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { requireClientAccess } from "@/app/lib/authz";
import { isValidClientCode } from "@/app/lib/validators";
import { registerTasting } from "@/app/lib/tasting/registerTasting";
import { getSavedQuote, deleteSavedQuote } from "@/app/lib/savedQuotes";
import type { SelectionMode } from "@/app/lib/tasting/policy";

const isAdmin = (role: string) => role === "admin" || role === "executive" || role === "sales_admin";

// 시음주 등록 — POST { client_code, client_type, client_name, item_no?, mode?, force?, manager? }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const clientCode = String(body.client_code || "").trim();
    const clientType = body.client_type === "glass" ? "glass" : "wine";
    if (!isValidClientCode(clientCode)) return NextResponse.json({ error: "Invalid client_code" }, { status: 400 });
    const access = await requireClientAccess(clientCode, clientType);
    if (access) return access;

    const manager = isAdmin(session.role) ? body.manager || session.manager : session.manager;
    const mode: SelectionMode | undefined = ["recommend", "manual", "monthly"].includes(body.mode) ? body.mode : undefined;

    const shipDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.ship_date || "")) ? String(body.ship_date) : undefined;
    const result = await registerTasting({
      clientCode,
      clientName: String(body.client_name || ""),
      clientType,
      manager,
      itemNo: body.item_no ? String(body.item_no).trim() : undefined,
      modeOverride: mode,
      force: !!body.force,
      shipDate,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("POST /api/sales/tasting/register error:", err);
    return NextResponse.json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

// 시음주 등록 취소(삭제) — DELETE ?id=&client_code=&type=wine|glass
// 실수로 등록한 시음주 견적(saved_quotes.is_tasting) 1건 삭제.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const id = Number(sp.get("id"));
    const clientCode = String(sp.get("client_code") || "").trim();
    const clientType = sp.get("type") === "glass" ? "glass" : "wine";
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    if (!isValidClientCode(clientCode)) return NextResponse.json({ error: "Invalid client_code" }, { status: 400 });
    const access = await requireClientAccess(clientCode, clientType);
    if (access) return access;

    // 안전 확인: 해당 견적이 이 거래처의 시음주가 맞을 때만 삭제
    const q = await getSavedQuote(id);
    if (!q || !q.is_tasting || String(q.client_code || "") !== clientCode) {
      return NextResponse.json({ ok: false, error: "삭제할 시음주를 찾을 수 없습니다." }, { status: 404 });
    }
    await deleteSavedQuote(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/tasting/register error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
