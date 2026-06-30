import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getMonthlyPick, setMonthlyPick, clearMonthlyPick, type MonthlyPick } from "@/app/lib/tasting/monthlyPick";
import { getItemBrief } from "@/app/lib/tasting/candidates";

// 이달의 시음주(1픽) — 담당자별. GET ?company= / PUT { company, item_no, item_name } / DELETE ?company=
const co = (v: string | null) => (v === "DL" ? "DL" : "CDV");

/** 1픽에 재고·공급가 붙이기(표시용). */
async function enrich(pick: MonthlyPick | null, company: "CDV" | "DL") {
  if (!pick) return null;
  const brief = await getItemBrief(company, pick.item_no);
  return { ...pick, available_stock: brief?.available_stock ?? null, supply_price: brief?.supply_price ?? null };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const company = co(new URL(req.url).searchParams.get("company"));
    const pick = await enrich(await getMonthlyPick(company, session.manager), company);
    return NextResponse.json({ pick });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const company = co(body.company);
    const itemNo = String(body.item_no || "").trim();
    if (!itemNo) return NextResponse.json({ error: "item_no required" }, { status: 400 });
    await setMonthlyPick(company, session.manager, itemNo, String(body.item_name || ""));
    const pick = await enrich(await getMonthlyPick(company, session.manager), company);
    return NextResponse.json({ pick });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const company = co(new URL(req.url).searchParams.get("company"));
    await clearMonthlyPick(company, session.manager);
    return NextResponse.json({ pick: null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
