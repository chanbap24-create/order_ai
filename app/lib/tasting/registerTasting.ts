// 시음주 자동등록 핵심 서비스: 와인 결정(추천/수동/이달) → 월 한도 체크 → 시음주 견적 1병 저장.
// 시음주는 saved_quotes(is_tasting=true)에 100%할인 1병으로 기록 → 거래처 보기·전환추적·추천학습 재사용.
import { supabase } from "@/app/lib/db";
import { saveQuote } from "@/app/lib/savedQuotes";
import { getTastingPolicy, getMonthlyTastingUsage, type SelectionMode } from "./policy";
import { getMonthlyPick } from "./monthlyPick";
import { getTastingSettings } from "./settings";
import { listTastingCandidates, getAiCandidates, passesTasting } from "./candidates";

/** 시음주 후보 풀(필터 통과)에서 거래처 추천순위 우선, 없으면 재고 최다. 출처 표시. */
async function pickFromInventory(
  company: "CDV" | "DL",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
  preferOrder: string[],
): Promise<{ itemNo: string; source: "ai" | "stock" } | null> {
  const pool = await listTastingCandidates(company, settings, 400);
  if (pool.length === 0) return null;
  for (const code of preferOrder) {
    const hit = pool.find((r) => r.item_no === code);
    if (hit) return { itemNo: hit.item_no, source: "ai" }; // 거래처 AI 추천 순위 적용
  }
  return { itemNo: pool[0].item_no, source: "stock" }; // 재고 최다 폴백
}

export interface RegisterTastingParams {
  clientCode: string;
  clientName: string;
  clientType: "wine" | "glass";
  manager: string;
  itemNo?: string; // 수동 지정(있으면 선정방식 무시)
  modeOverride?: SelectionMode; // 정책 선정방식 대신 강제
  force?: boolean; // 월 한도 무시(관리자)
  shipDate?: string; // 출고일(YYYY-MM-DD) — 발주 배송일. 결재 지급일자로 사용.
}

export interface RegisterTastingResult {
  ok: boolean;
  reason?: string;
  savedQuoteId?: number;
  item?: { item_no: string; item_name: string; supply_price: number; available_stock: number };
  usage?: { qty: number; amount: number; qtyLimit: number; amountLimit: number | null };
  source?: "manual" | "monthly" | "ai" | "stock"; // 와인을 어떻게 골랐는지
  note?: string; // 진단(추천 실패 사유 등)
}

async function fetchItem(itemNo: string, company: "CDV" | "DL") {
  const table = company === "DL" ? "inventory_dl" : "inventory_cdv";
  const { data } = await supabase
    .from(table)
    .select("item_no, item_name, supply_price, retail_price, available_stock")
    .eq("item_no", itemNo)
    .maybeSingle();
  return data as {
    item_no: string;
    item_name: string;
    supply_price: number;
    retail_price: number;
    available_stock: number;
  } | null;
}

export async function registerTasting(p: RegisterTastingParams): Promise<RegisterTastingResult> {
  const company: "CDV" | "DL" = p.clientType === "glass" ? "DL" : "CDV";
  const policy = await getTastingPolicy(p.clientCode, p.clientType);
  const mode: SelectionMode = p.modeOverride ?? policy.selection_mode;

  // 1) 시음주 와인 결정 — 우선순위: 수동 지정 > 이달의 시음주(1픽) > 거래처 AI 추천+필터
  let itemNo = p.itemNo;
  let source: RegisterTastingResult["source"] = p.itemNo ? "manual" : undefined;
  let note = "";
  if (!itemNo) {
    // 이달의 시음주가 지정돼 있으면 그게 1픽(선정방식과 무관하게 최우선).
    const monthly = await getMonthlyPick(company, p.manager);
    if (monthly) {
      itemNo = monthly.item_no;
      source = "monthly";
    } else if (mode === "monthly") {
      return { ok: false, reason: "이달의 시음주가 지정되지 않았습니다." };
    } else if (mode === "recommend") {
      const settings = await getTastingSettings(company);
      // 1순위: 거래처 AI 추천견적 후보(필터 통과) 중 점수 최상위.
      if (p.clientType === "wine") {
        try {
          const ai = await getAiCandidates(p.clientCode, company);
          const hit = ai.find((c) => passesTasting(c, settings));
          if (hit) {
            itemNo = hit.item_no;
            source = "ai";
          } else if (ai.length === 0) {
            note = "거래처 AI 추천 결과 없음(구매이력 부족 가능)";
          } else {
            note = "AI 추천 중 필터 통과 없음 → 재고순";
          }
        } catch (e) {
          note = `거래처 AI 추천 호출 실패: ${e instanceof Error ? e.message : String(e)}`;
        }
      } else {
        note = "글라스(DL)는 AI 추천 미지원 → 재고순";
      }
      // 폴백: 필터 통과 재고 최다
      if (!itemNo) {
        const picked = await pickFromInventory(company, settings, []);
        if (!picked) return { ok: false, reason: "필터를 통과하는 시음주가 없습니다 (재고/가격/타입 조건 확인)." };
        itemNo = picked.itemNo;
        source = "stock";
      }
    } else {
      return { ok: false, reason: "시음주 품번이 필요합니다(수동 모드)." };
    }
  }

  const item = await fetchItem(itemNo, company);
  if (!item) return { ok: false, reason: `품번 ${itemNo} 재고 정보를 찾을 수 없습니다.` };
  const supply = Number(item.supply_price) || 0;
  const stock = Number(item.available_stock) || 0;
  if (stock <= 0 && !p.force) {
    return { ok: false, reason: `${item.item_name} 재고 없음(0병) — 시음주로 등록 불가.` };
  }

  // 2) 월 한도 체크 (병수 + 금액). force면 통과.
  const usage = await getMonthlyTastingUsage(p.clientCode);
  const usageInfo = {
    qty: usage.qty,
    amount: usage.amount,
    qtyLimit: policy.monthly_qty_limit,
    amountLimit: policy.monthly_amount_limit,
  };
  if (!p.force) {
    if (usage.qty + 1 > policy.monthly_qty_limit) {
      return { ok: false, reason: `월 병수 한도 초과 (${usage.qty}/${policy.monthly_qty_limit}병)`, usage: usageInfo };
    }
    if (policy.monthly_amount_limit != null && usage.amount + supply > policy.monthly_amount_limit) {
      return { ok: false, reason: "월 금액 상한 초과", usage: usageInfo };
    }
  }

  // 3) 시음주 견적(100%할인 = 무상 1병) 저장. discount_rate는 분수(1=100%off) 컨벤션.
  const quoteItem = {
    item_code: item.item_no,
    product_name: item.item_name,
    supply_price: supply,
    retail_price: Number(item.retail_price) || 0,
    discount_rate: 1,
    discounted_price: 0,
    quantity: 1,
    note: "시음주",
  };
  const { id } = await saveQuote({
    manager: p.manager,
    client_code: p.clientCode,
    client_name: p.clientName,
    company,
    items: [quoteItem],
    is_tasting: true,
    doc_settings: p.shipDate ? { ship_date: p.shipDate } : undefined, // 출고일 기록(결재 지급일자)
  });

  return {
    ok: true,
    savedQuoteId: id,
    item: { item_no: item.item_no, item_name: item.item_name, supply_price: supply, available_stock: stock },
    usage: usageInfo,
    source,
    note: note || undefined,
  };
}
