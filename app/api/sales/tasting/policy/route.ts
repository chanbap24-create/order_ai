import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { requireClientAccess } from "@/app/lib/authz";
import { isValidClientCode } from "@/app/lib/validators";
import {
  getTastingPolicy,
  upsertTastingPolicy,
  getMonthlyTastingUsage,
  getTastingHistory,
} from "@/app/lib/tasting/policy";

// 거래처 시음주 정책 + 이달 사용량 + 이력.
// GET ?client_code=&type=wine|glass / PUT { client_code, client_type, enabled?, monthly_qty_limit?, monthly_amount_limit?, selection_mode? }

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const clientCode = String(sp.get("client_code") || "").trim();
    const clientType = sp.get("type") === "glass" ? "glass" : "wine";
    if (!isValidClientCode(clientCode)) return NextResponse.json({ error: "Invalid client_code" }, { status: 400 });
    const access = await requireClientAccess(clientCode, clientType);
    if (access) return access;

    const [policy, usage, history] = await Promise.all([
      getTastingPolicy(clientCode, clientType),
      getMonthlyTastingUsage(clientCode),
      getTastingHistory(clientCode),
    ]);
    return NextResponse.json({ policy, usage, history });
  } catch (err) {
    console.error("GET /api/sales/tasting/policy error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const clientCode = String(body.client_code || "").trim();
    const clientType = body.client_type === "glass" ? "glass" : "wine";
    if (!isValidClientCode(clientCode)) return NextResponse.json({ error: "Invalid client_code" }, { status: 400 });
    const access = await requireClientAccess(clientCode, clientType);
    if (access) return access;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any = { client_code: clientCode, client_type: clientType };
    if ("enabled" in body) patch.enabled = !!body.enabled;
    if ("monthly_qty_limit" in body)
      patch.monthly_qty_limit = Math.max(0, Math.min(20, Math.trunc(Number(body.monthly_qty_limit)) || 0));
    if ("monthly_amount_limit" in body)
      patch.monthly_amount_limit =
        body.monthly_amount_limit == null || body.monthly_amount_limit === ""
          ? null
          : Math.max(0, Math.trunc(Number(body.monthly_amount_limit)) || 0);
    if ("selection_mode" in body)
      patch.selection_mode = ["recommend", "manual", "monthly"].includes(body.selection_mode)
        ? body.selection_mode
        : "recommend";

    await upsertTastingPolicy(patch, session.manager);
    const policy = await getTastingPolicy(clientCode, clientType);
    return NextResponse.json({ policy });
  } catch (err) {
    console.error("PUT /api/sales/tasting/policy error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
