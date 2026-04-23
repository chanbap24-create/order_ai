import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { supabase } from "@/app/lib/db";

/**
 * GET /api/user/preferences
 * 응답: { preferences: { [key]: any } } — 현재 사용자의 모든 설정
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("key, value")
      .eq("manager", session.manager);

    if (error) throw error;

    const map: Record<string, any> = {};
    for (const row of data || []) {
      map[row.key as string] = row.value;
    }
    return NextResponse.json({ authenticated: true, preferences: map });
  } catch (err) {
    console.error("GET /api/user/preferences error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/user/preferences
 * body: { key: string, value: unknown } — 1개 설정 upsert
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.key !== "string" || !body.key.trim()) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    if (body.value === undefined) {
      return NextResponse.json({ error: "value required" }, { status: 400 });
    }

    const { error } = await supabase.from("user_preferences").upsert(
      {
        manager: session.manager,
        key: body.key,
        value: body.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "manager,key" },
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/user/preferences error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/preferences?key=xxx
 * 특정 설정 1개 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_preferences")
      .delete()
      .eq("manager", session.manager)
      .eq("key", key);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/user/preferences error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
