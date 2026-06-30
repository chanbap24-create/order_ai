import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { requireClientAccess } from "@/app/lib/authz";
import { isValidClientCode } from "@/app/lib/validators";
import { registerTasting } from "@/app/lib/tasting/registerTasting";
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

    const result = await registerTasting({
      clientCode,
      clientName: String(body.client_name || ""),
      clientType,
      manager,
      itemNo: body.item_no ? String(body.item_no).trim() : undefined,
      modeOverride: mode,
      force: !!body.force,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("POST /api/sales/tasting/register error:", err);
    return NextResponse.json({ ok: false, reason: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
