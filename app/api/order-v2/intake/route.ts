// iOS 단축어 → 카톡 스샷 원터치 발주 수신함.
// POST: 토큰 인증(x-shortcut-token) + 이미지(multipart) → 파싱 → order_intake 저장.
// GET: 로그인 담당자의 대기중 수신 목록. PATCH: 처리/무시 상태 변경.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { extractOrderFromImage } from "@/app/lib/orderIntake";
import { getManagerClients } from "@/app/lib/orderClients";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

// 단축어에서 이미지 업로드 (multipart form-data: image 파일 + tab)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-shortcut-token") || "";
    if (!token) return NextResponse.json({ error: "토큰이 필요합니다." }, { status: 401 });
    const { data: tk } = await supabase.from("shortcut_tokens").select("manager").eq("token", token).maybeSingle();
    if (!tk?.manager) return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
    const manager = tk.manager;

    const form = await req.formData();
    const file = form.get("image");
    const tab = String(form.get("tab") || "CDV") === "DL" ? "DL" : "CDV";
    if (!(file instanceof File)) return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: "이미지가 너무 큽니다.(최대 8MB)" }, { status: 400 });
    const media_type = ALLOWED.has(file.type) ? file.type : "image/png";

    const clients = await getManagerClients(manager, tab);
    const result = await extractOrderFromImage(buf.toString("base64"), media_type, clients);

    const lines = String(result.order_text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const summary = result.found
      ? `${result.client_hint || "거래처 미상"} · ${lines.length}줄`
      : "발주 인식 실패";

    await supabase.from("order_intake").insert({
      manager, tab,
      client_hint: result.client_hint || null,
      order_text: result.order_text || null,
      result,
      status: result.found ? "pending" : "failed",
    });
    return NextResponse.json({ ok: !!result.found, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "분석 실패" }, { status: 500 });
  }
}

// 로그인 담당자의 대기중 수신함
export async function GET() {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { data } = await supabase
    .from("order_intake")
    .select("id, tab, client_hint, order_text, result, status, created_at")
    .eq("manager", session.manager).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ items: data || [] });
}

// 처리 완료/무시
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { id, status } = await req.json();
  if (!id || !["done", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  await supabase.from("order_intake").update({ status }).eq("id", id).eq("manager", session.manager);
  return NextResponse.json({ ok: true });
}
