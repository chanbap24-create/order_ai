import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { supabase } from "@/app/lib/db";
import { learnFromSelection } from "@/app/lib/autoLearn";

/**
 * 규칙 학습용 alias 정규화
 * - 너무 공격적이면 안 됨 (search_key랑 다름!)
 * - resolveItems.ts의 exact/contains 기준과 동일해야 함
 */
function normalizeAlias(raw: string) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()\-_/.,]/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rawAlias = String(body?.alias ?? "").trim();
    const canonical = String(body?.canonical ?? "").trim();
    const clientCode = String(body?.client_code ?? "*").trim(); // 거래처 코드 (기본값: '*' = 전역)

    if (!rawAlias || !canonical) {
      return jsonResponse(
        { success: false, error: "alias/canonical required" },
        { status: 400 }
      );
    }

    // 규칙 학습용 alias 정규화
    const alias = normalizeAlias(rawAlias);

    if (!alias) {
      return jsonResponse(
        { success: false, error: "alias empty after normalize" },
        { status: 400 }
      );
    }

    // 거래처별 학습 with 누적 카운트
    const now = new Date().toISOString();

    // 기존 매핑 조회
    const { data: existing } = await supabase
      .from("item_alias")
      .select("canonical, count, client_code")
      .eq("alias", alias)
      .eq("client_code", clientCode)
      .maybeSingle();

    if (existing && existing.canonical === canonical) {
      // 같은 매핑: count 증가
      await supabase
        .from("item_alias")
        .update({
          count: (existing.count || 0) + 1,
          last_used_at: now,
        })
        .eq("alias", alias)
        .eq("client_code", clientCode);
    } else {
      // 새로운 매핑: upsert (alias + client_code 복합 키)
      const { error } = await supabase.from("item_alias").upsert(
        {
          alias,
          canonical,
          client_code: clientCode,
          count: 1,
          last_used_at: now,
          created_at: now,
        },
        { onConflict: "alias,client_code" }
      );

      if (error) throw error;
    }

    // 실제 저장된 값 반환
    const { data: row } = await supabase
      .from("item_alias")
      .select("alias, canonical, client_code, count, last_used_at, created_at")
      .eq("alias", alias)
      .eq("client_code", clientCode)
      .maybeSingle();

    // 자동 학습 시스템 연동: 토큰 매핑도 자동으로 학습
    try {
      // canonical이 품목번호인 경우 품목명 조회
      let itemName = canonical;
      let itemNo = canonical;

      // canonical이 숫자면 품목번호로 간주하고 품목명 조회
      if (/^\d+$/.test(canonical) || /^[A-Z0-9]+$/.test(canonical)) {
        // Supabase에서 품목명 조회 시도
        const tables = ["items", "item_master", "Downloads_items"];
        for (const table of tables) {
          try {
            const { data: item } = await supabase
              .from(table)
              .select("item_no, item_name")
              .eq("item_no", canonical)
              .limit(1)
              .maybeSingle();

            if (item) {
              itemNo = item.item_no;
              itemName = item.item_name;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // 자동 학습 실행 (토큰 매핑 + ML 데이터)
      const learnResult = await learnFromSelection({
        query: rawAlias,
        selectedItem: {
          item_no: itemNo,
          item_name: itemName,
        },
        rejectedItems: [],
        clientCode: body?.client_code || "manual_learning",
        features: {
          manual_input: true,
          source: "learn_item_alias_api",
        } as any,
      });

      console.log(`[learn-item-alias] 자동 학습 완료:`, learnResult);

      return jsonResponse({
        success: true,
        saved: 1,
        row,
        autoLearn: {
          enabled: true,
          mappings: learnResult.mappings,
          mlDataId: learnResult.mlDataId,
          message: `토큰 매핑 ${learnResult.mappings.length}개 학습됨`,
        },
      });
    } catch (autoLearnError) {
      console.error(
        "[learn-item-alias] 자동 학습 실패 (계속 진행):",
        autoLearnError
      );

      // 자동 학습 실패해도 item_alias는 저장되었으므로 성공 반환
      return jsonResponse({
        success: true,
        saved: 1,
        row,
        autoLearn: {
          enabled: false,
          error: String(autoLearnError),
        },
      });
    }
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
