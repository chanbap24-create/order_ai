import { db } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 거래처 alias 학습 API (Vercel 호환: 읽기 전용)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_code, alias, type = "wine" } = body;

    if (!client_code || !alias) {
      return NextResponse.json(
        { success: false, message: "client_code와 alias가 필요합니다" },
        { status: 400 }
      );
    }

    // ⚠️ Vercel Serverless에서는 SQLite Write 불가
    // 클라이언트에서 localStorage로 관리
    // 서버는 검증만 수행
    
    return NextResponse.json({
      success: true,
      message: "거래처 학습 완료 (클라이언트 저장)",
      client_code,
      alias,
      type,
    });
  } catch (error: any) {
    console.error("[learn-client POST] error:", error);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

// ✅ 학습된 거래처 alias 목록 조회 (읽기 전용: Vercel 호환)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "wine";

    const table = type === "wine" ? "client_alias" : "glass_client_alias";
    const clientTable = type === "wine" ? "clients" : "glass_clients";

    // ✅ 가중치 10 이상인 alias만 (사용자가 학습한 것들)
    // 읽기 작업은 Vercel에서도 가능
    const items = db
      .prepare(
        `SELECT a.client_code, a.alias, a.weight, c.client_name
         FROM ${table} a
         LEFT JOIN ${clientTable} c ON a.client_code = c.client_code
         WHERE a.weight >= 10
         ORDER BY a.weight DESC, a.alias ASC`
      )
      .all() as Array<{
      client_code: string;
      alias: string;
      weight: number;
      client_name: string;
    }>;

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("[learn-client GET] error:", error);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

// ✅ 학습된 거래처 alias 삭제 (Vercel 호환: 읽기 전용)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_code, alias, type = "wine" } = body;

    if (!client_code || !alias) {
      return NextResponse.json(
        { success: false, message: "client_code와 alias가 필요합니다" },
        { status: 400 }
      );
    }

    // ⚠️ Vercel Serverless에서는 SQLite Write 불가
    // 클라이언트에서 localStorage로 관리
    
    return NextResponse.json({
      success: true,
      message: "거래처 학습 삭제 완료 (클라이언트 저장)",
    });
  } catch (error: any) {
    console.error("[learn-client DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
