import { NextResponse } from "next/server";
import { jsonResponse } from "@/app/lib/api-response";
import { parseOrderWithGPT } from "@/app/lib/parseOrderWithGPT";
import { db } from "@/app/lib/db";
import { resolveItemsByClientWeighted } from "@/app/lib/resolveItemsWeighted";
import { searchNewItem } from "@/app/lib/newItemResolver";

export const runtime = "nodejs";

// GET 메소드 추가 (API 상태 확인용)
export async function GET() {
  return jsonResponse({
    success: true,
    message: "parse-order-gpt API is running. Use POST method to parse orders with GPT."
  });
}

function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "")
    .replace(/(주식회사|\(주\)|주\.)/g, "");
}

/**
 * 거래처 resolve 함수 (기존 로직 유지)
 */
function resolveClient(clientText: string, forceResolve: boolean) {
  if (!clientText) {
    return {
      status: "needs_review_client",
      candidates: [],
    };
  }

  // 1) 거래처 코드 직접 입력 (숫자 5자리)
  if (/^\d{5}$/.test(clientText)) {
    const directClient = db
      .prepare(`SELECT client_code, client_name FROM clients WHERE client_code = ?`)
      .get(clientText) as any;
    
    if (directClient) {
      return {
        status: "resolved",
        client_code: String(directClient.client_code),
        client_name: String(directClient.client_name),
        method: "exact_code",
      };
    }
  }

  const rows = db
    .prepare(`SELECT client_code, alias, weight FROM client_alias`)
    .all() as Array<{ client_code: any; alias: any; weight?: any }>;

  // 2) exact(norm) 매칭
  const exact = rows.find(
    (r) => norm(r.alias) && norm(r.alias) === norm(clientText)
  );
  if (exact) {
    return {
      status: "resolved",
      client_code: String(exact.client_code),
      client_name: String(exact.alias),
      method: "exact_norm",
    };
  }

  // 3) fuzzy 매칭
  const scored = rows
    .map((r) => {
      const a = norm(clientText);
      const b = norm(r.alias);
      if (!a || !b) return { client_name: String(r.alias), client_code: String(r.client_code), score: 0 };

      if (a === b) return { client_name: String(r.alias), client_code: String(r.client_code), score: 1.0 };
      if (b.includes(a)) return { client_name: String(r.alias), client_code: String(r.client_code), score: 0.90 };

      const aset = new Set(a.split(""));
      let common = 0;
      for (const ch of aset) if (b.includes(ch)) common++;
      const overlap = common / Math.max(a.length, b.length);

      const w = Number(r.weight ?? 1);
      let bonus = Math.min(0.2, Math.max(0, (w - 1) * 0.02));
      if (overlap <= 0.5) bonus = 0;

      return {
        client_name: String(r.alias),
        client_code: String(r.client_code),
        score: Number(Math.min(1.0, overlap * 0.9 + bonus).toFixed(3)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const top = scored[0];
  const second = scored[1];

  const canAuto = top && top.score >= 0.90 && (!second || top.score - second.score >= 0.08);
  if (canAuto) return { status: "resolved", ...top, method: "fuzzy_auto" };

  const forceOk =
    Boolean(forceResolve) &&
    top &&
    top.score >= 0.45 &&
    (!second || top.score - second.score >= 0.15);

  if (forceOk) return { status: "resolved", ...top, method: "fuzzy_force" };

  return {
    status: "needs_review_client",
    score: top?.score ?? 0,
    candidates: scored,
  };
}

/**
 * 직원용 메시지 생성
 */
function formatStaffMessage(client: any, items: any[]) {
  const lines: string[] = [];
  lines.push(`거래처: ${client.client_name} (${client.client_code})`);
  lines.push(`배송 예정일: (자동계산)`);
  lines.push("");
  lines.push("품목:");

  for (const it of items) {
    if (it.resolved) {
      lines.push(`- ${it.item_no} / ${it.item_name} / ${it.qty}병`);
    } else {
      lines.push(`- 확인필요 / "${it.name}" / ${it.qty}병`);
    }
  }

  lines.push("");
  lines.push("발주 요청드립니다.");
  return lines.join("\n");
}

/**
 * 메인 POST 핸들러
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message ?? "";
    const forceResolve = Boolean(body?.force_resolve);
    const pageType = body?.type || "wine";

    console.log("\n=== GPT 기반 발주 파싱 시작 ===");
    console.log("메시지:", message);
    console.log("페이지 타입:", pageType);

    // Step 1: GPT로 발주 메시지 파싱 (거래처 코드 없이 먼저 시도)
    const gptParsed = await parseOrderWithGPT(message, undefined, { type: pageType as 'wine' | 'glass' });
    
    console.log("\n[GPT 파싱 결과]");
    console.log("- 거래처:", gptParsed.client);
    console.log("- 품목 수:", gptParsed.items.length);
    console.log("- 품목 상세:", gptParsed.items.map(i => ({
      name: i.name,
      qty: i.qty,
      matched: i.matched_item_no,
      confidence: i.confidence,
    })));

    // Step 2: 거래처 확정
    const clientResolved = resolveClient(gptParsed.client, forceResolve);
    
    if (clientResolved.status !== "resolved") {
      console.log("\n[거래처 미확정] 사용자 선택 필요");
      return jsonResponse({
        success: true,
        status: "needs_review_client",
        client: clientResolved,
        gpt_parsed: gptParsed,
        debug: {
          message: "거래처를 확정할 수 없습니다. 후보 목록에서 선택해주세요.",
        },
      } as any);
    }

    console.log("\n[거래처 확정]", clientResolved.client_name, `(${clientResolved.client_code})`);

    const clientCode = clientResolved.client_code;

    // Step 3: GPT가 매칭한 품목을 다시 재파싱 (거래처 입고 이력 포함)
    const gptReMatched = await parseOrderWithGPT(message, clientCode, { type: pageType as 'wine' | 'glass' });
    
    console.log("\n[거래처 입고 이력 기반 재매칭]");
    console.log("- High confidence:", gptReMatched.items.filter(i => i.confidence === 'high').length);
    console.log("- Medium confidence:", gptReMatched.items.filter(i => i.confidence === 'medium').length);
    console.log("- Low confidence:", gptReMatched.items.filter(i => i.confidence === 'low').length);

    // Step 4: GPT 결과를 기존 시스템 형식으로 변환
    const parsedItems = gptReMatched.items.map(item => ({
      raw: `${item.name} ${item.qty}`,
      name: item.name,
      qty: item.qty,
      gpt_matched_item_no: item.matched_item_no,
      gpt_confidence: item.confidence,
    }));

    // Step 5: 기존 가중치 시스템으로 품목 resolve (GPT 결과와 비교용)
    const resolvedItems = resolveItemsByClientWeighted(clientCode, parsedItems, {
      minScore: 0.55,
      minGap: 0.05,
      topN: 5,
    });

    // Step 6: GPT 결과와 기존 시스템 결과 통합
    const finalItems = resolvedItems.map((item: any, idx: number) => {
      const gptItem = gptReMatched.items[idx];
      
      // GPT가 high confidence로 매칭했으면 우선 채택
      if (gptItem?.confidence === 'high' && gptItem.matched_item_no) {
        // GPT 매칭 품번으로 상세 정보 가져오기
        const itemDetail = db
          .prepare(`SELECT item_no, item_name FROM client_item_stats WHERE client_code = ? AND item_no = ? LIMIT 1`)
          .get(clientCode, gptItem.matched_item_no) as any;

        if (itemDetail) {
          return {
            ...item,
            resolved: true,
            item_no: itemDetail.item_no,
            item_name: itemDetail.item_name,
            method: 'gpt_high_confidence',
            gpt_info: {
              matched_item_no: gptItem.matched_item_no,
              confidence: gptItem.confidence,
            },
          };
        }
      }

      // GPT medium/low이거나 실패한 경우 기존 시스템 결과 사용
      // suggestions에 GPT 추천도 추가
      const candidates = item.candidates || [];
      const suggestions = candidates.slice(0, 3);

      // GPT가 매칭한 품목이 suggestions에 없으면 추가
      if (gptItem?.matched_item_no && !suggestions.find((s: any) => s.item_no === gptItem.matched_item_no)) {
        const gptSuggestion = db
          .prepare(`SELECT item_no, item_name FROM client_item_stats WHERE client_code = ? AND item_no = ? LIMIT 1`)
          .get(clientCode, gptItem.matched_item_no) as any;

        if (gptSuggestion) {
          suggestions.unshift({
            item_no: gptSuggestion.item_no,
            item_name: gptSuggestion.item_name,
            score: gptItem.confidence === 'medium' ? 0.75 : 0.65,
            source: 'gpt',
          });
        }
      }

      return {
        ...item,
        suggestions: suggestions.slice(0, 5),
        gpt_info: {
          matched_item_no: gptItem?.matched_item_no,
          confidence: gptItem?.confidence,
        },
      };
    });

    const hasUnresolved = finalItems.some((x: any) => !x.resolved);

    console.log("\n[최종 결과]");
    console.log("- 확정 품목:", finalItems.filter((x: any) => x.resolved).length);
    console.log("- 미확정 품목:", finalItems.filter((x: any) => !x.resolved).length);

    return jsonResponse({
      success: true,
      status: hasUnresolved ? "needs_review_items" : "resolved",
      client: clientResolved,
      items: finalItems,
      staff_message: formatStaffMessage(clientResolved, finalItems),
      debug: {
        gpt_parsed: gptParsed,
        gpt_rematched: gptReMatched,
        message: "GPT 기반 파싱 완료",
      },
    } as any);

  } catch (error: any) {
    console.error("GPT 파싱 오류:", error);
    return jsonResponse(
      { success: false, error: String(error?.message || error) } as any,
      { status: 500 }
    );
  }
}
