// 로그인 담당자의 단축어 토큰 조회/발급. 단축어 헤더(x-shortcut-token)에 넣어 사용.
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.manager) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const { data } = await supabase.from("shortcut_tokens").select("token").eq("manager", session.manager).maybeSingle();
  if (data?.token) return NextResponse.json({ token: data.token });
  const token = `sc_${randomUUID().replace(/-/g, "")}`;
  const { error } = await supabase.from("shortcut_tokens").insert({ token, manager: session.manager });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}
