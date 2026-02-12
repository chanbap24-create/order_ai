import { supabase } from "@/app/lib/db";
import { NextRequest } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";

export const dynamic = "force-dynamic";

// 거래처 alias 학습 API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_code, alias, type = "wine" } = body;

    if (!client_code || !alias) {
      return jsonResponse(
        { success: false, message: "client_code와 alias가 필요합니다" },
        { status: 400 }
      );
    }

    const table = type === "wine" ? "client_alias" : "glass_client_alias";

    // Supabase는 write 가능하므로 직접 upsert
    const { error } = await supabase.from(table).upsert(
      {
        client_code,
        alias,
        weight: 10,
      },
      { onConflict: "client_code,alias" }
    );

    if (error) throw error;

    return jsonResponse({
      success: true,
      message: "거래처 학습 완료",
      client_code,
      alias,
      type,
    });
  } catch (error: any) {
    console.error("[learn-client POST] error:", error);
    return jsonResponse(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

// 학습된 거래처 alias 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "wine";

    const table = type === "wine" ? "client_alias" : "glass_client_alias";
    const clientTable = type === "wine" ? "clients" : "glass_clients";

    // 가중치 10 이상인 alias만 (사용자가 학습한 것들)
    const { data: aliases, error: aliasError } = await supabase
      .from(table)
      .select("client_code, alias, weight")
      .gte("weight", 10)
      .order("weight", { ascending: false })
      .order("alias", { ascending: true });

    if (aliasError) throw aliasError;

    // client_name을 별도로 조회하여 join
    const clientCodes = [
      ...new Set((aliases || []).map((a: any) => a.client_code)),
    ];

    let clientMap: Record<string, string> = {};
    if (clientCodes.length > 0) {
      const { data: clients } = await supabase
        .from(clientTable)
        .select("client_code, client_name")
        .in("client_code", clientCodes);

      if (clients) {
        for (const c of clients) {
          clientMap[c.client_code] = c.client_name;
        }
      }
    }

    const items = (aliases || []).map((a: any) => ({
      client_code: a.client_code,
      alias: a.alias,
      weight: a.weight,
      client_name: clientMap[a.client_code] || null,
    }));

    return jsonResponse({
      success: true,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("[learn-client GET] error:", error);
    return jsonResponse(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

// 학습된 거래처 alias 삭제
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_code, alias, type = "wine" } = body;

    if (!client_code || !alias) {
      return jsonResponse(
        { success: false, message: "client_code와 alias가 필요합니다" },
        { status: 400 }
      );
    }

    const table = type === "wine" ? "client_alias" : "glass_client_alias";

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("client_code", client_code)
      .eq("alias", alias);

    if (error) throw error;

    return jsonResponse({
      success: true,
      message: "거래처 학습 삭제 완료",
    });
  } catch (error: any) {
    console.error("[learn-client DELETE] error:", error);
    return jsonResponse(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
