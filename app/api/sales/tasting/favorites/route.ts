import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { listFavorites, addFavorite, removeFavorite, setDefaultFavorite, type Favorite } from "@/app/lib/tasting/favorites";
import { getItemBrief } from "@/app/lib/tasting/candidates";

// 시음주 즐겨찾기(담당자별). GET ?company= / POST {company,item_no,item_name} / PATCH {company,item_no,is_default} / DELETE ?company=&item_no=
const co = (v: string | null): "CDV" | "DL" => (v === "DL" ? "DL" : "CDV");

/** 재고·공급가 붙이기(표시용). */
async function enrich(favs: Favorite[], company: "CDV" | "DL") {
  return Promise.all(favs.map(async (f) => {
    const brief = await getItemBrief(company, f.item_no);
    return { ...f, available_stock: brief?.available_stock ?? null, supply_price: brief?.supply_price ?? null };
  }));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const company = co(new URL(req.url).searchParams.get("company"));
    const favorites = await enrich(await listFavorites(company, session.manager), company);
    return NextResponse.json({ favorites });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const company = co(body.company);
    const itemNo = String(body.item_no || "").trim();
    if (!itemNo) return NextResponse.json({ error: "item_no required" }, { status: 400 });
    await addFavorite(company, session.manager, itemNo, String(body.item_name || ""));
    const favorites = await enrich(await listFavorites(company, session.manager), company);
    return NextResponse.json({ favorites });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const company = co(body.company);
    const itemNo = String(body.item_no || "").trim();
    await setDefaultFavorite(company, session.manager, body.is_default && itemNo ? itemNo : null);
    const favorites = await enrich(await listFavorites(company, session.manager), company);
    return NextResponse.json({ favorites });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const company = co(sp.get("company"));
    const itemNo = String(sp.get("item_no") || "").trim();
    if (itemNo) await removeFavorite(company, session.manager, itemNo);
    const favorites = await enrich(await listFavorites(company, session.manager), company);
    return NextResponse.json({ favorites });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
