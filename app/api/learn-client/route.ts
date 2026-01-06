import { db } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ✅ 거래처 alias 학습 API
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

    // ✅ 와인/와인잔에 따라 다른 테이블 사용
    const table = type === "wine" ? "client_alias" : "glass_client_alias";

    // ✅ 기존 alias가 있는지 확인
    const existing = db
      .prepare(`SELECT * FROM ${table} WHERE client_code = ? AND alias = ?`)
      .get(client_code, alias) as any;

    if (existing) {
      // 이미 있으면 가중치만 증가
      db.prepare(`UPDATE ${table} SET weight = weight + 5 WHERE client_code = ? AND alias = ?`)
        .run(client_code, alias);
    } else {
      // 없으면 새로 추가 (높은 가중치)
      db.prepare(`INSERT INTO ${table} (client_code, alias, weight) VALUES (?, ?, ?)`)
        .run(client_code, alias, 15);
    }

    return NextResponse.json({
      success: true,
      message: "거래처 학습 완료",
    });
  } catch (error: any) {
    console.error("거래처 학습 실패:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// ✅ 학습된 거래처 alias 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "wine";

    const table = type === "wine" ? "client_alias" : "glass_client_alias";
    const clientTable = type === "wine" ? "clients" : "glass_clients";

    // ✅ 가중치 10 이상인 alias만 (사용자가 학습한 것들)
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
    console.error("학습된 거래처 조회 실패:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// ✅ 학습된 거래처 alias 삭제
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

    const table = type === "wine" ? "client_alias" : "glass_client_alias";

    db.prepare(`DELETE FROM ${table} WHERE client_code = ? AND alias = ?`)
      .run(client_code, alias);

    return NextResponse.json({
      success: true,
      message: "거래처 학습 삭제 완료",
    });
  } catch (error: any) {
    console.error("거래처 학습 삭제 실패:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
