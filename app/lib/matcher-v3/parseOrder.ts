// 발주 v3 파이프라인: ① Claude 추출(와인 라인·수량만) → ③ matchLineV3 라인별 매칭.
// 응답은 v2 OrderLine 호환 형태 — 메시지 빌더(staffMessage)·학습(learnOrderCorrections) 재사용을 위해.
import { supabase } from '../db';
import { getClaudeClient } from '../claudeClient';
import { matchLineV3, embedBatch, cleanLineForSearch, loadClientHistory, type V3Result, type MatchTab } from './index';

const EXTRACT_MODEL = 'claude-haiku-4-5-20251001';

export type ExtractedLine = { name: string; qty: number; boxes?: number; price?: number };
// boxes: 박스 단위 주문 — 글라스는 품목별 본입수(units_per_box)가 달라 매칭 후 환산한다
// price: 라인에 병기된 지정 단가 ("489/48 12 6750" = 품번 12개 6,750원) — 메시지 가격에 우선 적용

/** ① 추출 — 자유 발주 텍스트에서 와인 라인만 분리. 인사말·질문·요청사항은 버린다. */
export async function extractOrderLines(orderText: string, tab: MatchTab = 'CDV'): Promise<{ lines: ExtractedLine[]; usage: { input_tokens: number; output_tokens: number } }> {
  const claude = getClaudeClient();
  const resp = await claude.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 1000,
    temperature: 0,
    tools: [{
      name: 'extract',
      description: '발주 텍스트에서 와인 주문 라인 추출',
      input_schema: {
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '품목 이름 부분 (수량·단위 제외, 원문 표기 유지)' },
                qty: { type: 'number', description: '수량. 미표기는 1' },
                boxes: { type: 'number', description: '박스/케이스 단위 주문이면 박스 수 (qty 대신)' },
                price: { type: 'number', description: '라인에 병기된 단가(원). "품명 12 6750"처럼 숫자 둘이면 앞=수량, 뒤=단가' },
              },
              required: ['name', 'qty'],
            },
          },
        },
        required: ['lines'],
      },
    }],
    tool_choice: { type: 'tool', name: 'extract' },
    messages: [{
      role: 'user',
      content: tab === 'DL'
        ? `다음 리델 글라스 발주 텍스트에서 주문 라인만 추출해.\n규칙: ① 인사말·질문·자료 요청·배송 요청사항은 라인이 아님 ② 한 줄에 여러 품목이면 분리 ③ 수량 단위: 개/잔/EA는 qty, 박스/케이스/CS는 boxes에 박스 수(개수 환산 금지 — 품목별 본입수가 다름) ④ 숫자가 둘 연속이면(예: \"489/48 12 6750\") 앞=수량(qty), 뒤=단가(price·원) — 절대 곱하지 마 ⑤ 이름은 원문 표기 그대로(오타 수정 금지).\n\n발주 텍스트:\n"""\n${orderText}\n"""`
        : `다음 와인 발주 텍스트에서 주문 라인만 추출해.\n규칙: ① 인사말·감사 인사·질문·자료 요청("카탈로그 보내주세요" 등)·배송 요청사항은 라인이 아님 ② 한 줄에 여러 와인이 있으면 분리 ③ 수량 단위: 병=1, 박스/케이스/CS=12병, 반박스=6병 ④ 이름 뒤 2자리 숫자+"빈"은 빈티지이므로 이름에 포함(수량 아님) ⑤ 이름은 원문 표기 그대로(오타 수정 금지).\n\n발주 텍스트:\n"""\n${orderText}\n"""`,
    }],
  });
  const tool = resp.content.find((c) => c.type === 'tool_use');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inp: any = tool && 'input' in tool ? tool.input : {};
  const lines: ExtractedLine[] = Array.isArray(inp.lines)
    ? inp.lines
        .map((l: { name?: unknown; qty?: unknown; boxes?: unknown }) => ({
          name: String(l.name || '').trim(),
          qty: Math.max(1, Math.trunc(Number(l.qty) || 1)),
          ...(Number(l.boxes) > 0 ? { boxes: Math.trunc(Number(l.boxes)) } : {}),
          ...(Number((l as { price?: unknown }).price) >= 100 ? { price: Math.trunc(Number((l as { price?: unknown }).price)) } : {}),
        }))
        .filter((l: ExtractedLine) => l.name.length >= 2)
        .slice(0, 30)
    : [];
  return { lines, usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens } };
}

/** 글라스 박스당 본입수 — v2 parse route와 동일 규칙 (레스토랑 시리즈만, 공급가 기준) */
function glassBoxUnits(itemName: string, supplyPrice: unknown): number {
  if (!/레스토랑/.test(itemName || '')) return 0;
  const p = Number(supplyPrice) || 0;
  if (p <= 0) return 0;
  if (p <= 20000) return 12;
  if (p <= 40000) return 6;
  return 0;
}

// v2 OrderLine 호환 응답 형태
export type V3OrderLine = {
  query: string;
  quantity: number;
  candidates: Array<{
    item_no: string; item_name: string; confidence: number;
    supply_price: number; available_stock: number; reasoning: string;
  }>;
  // v3 메타 — UI 뱃지용
  v3: { decidedBy: V3Result['decidedBy']; confidence: number; reason?: string; picked_in_history: boolean; picked_stock: number };
};

/** 빠른 라인 파서 — 비전 추출 결과("품목 수량\n품목 수량")는 이미 정형이라 LLM 재추출이 낭비.
 *  전 라인이 "이름 + 말미 수량(단위)" 패턴이면 정규식으로 즉시 분리 (LLM 홉 1개 제거, ~2-3초 절감). */
export function tryFastExtract(orderText: string, tab: MatchTab = 'CDV'): ExtractedLine[] | null {
  const rawLines = orderText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;
  const out: ExtractedLine[] = [];
  for (const raw of rawLines) {
    // "이름 수량 단가" (예: 489/48 12 6750 · 데구스타 12개 6,750원) — 뒤 숫자 1000 이상이면 단가
    const mp = raw.match(/^(.{2,}?)[\s,]+(\d{1,3})\s*(병|개|잔|본|ea)?[\s,]+([\d,]{4,9})\s*원?\.?$/i);
    if (mp) {
      const name = mp[1].trim();
      const price = parseInt(mp[4].replace(/,/g, ''), 10);
      if (name.length >= 2 && !/^\d+$/.test(name) && price >= 1000) {
        out.push({ name, qty: Math.max(1, parseInt(mp[2], 10)), price });
        continue;
      }
    }
    const m = raw.match(/^(.{2,}?)[\s,]*(\d{1,3})\s*(병|개|잔|본|ea|btl)?\.?$/i)
      || raw.match(/^(.{2,}?)[\s,]*(\d{1,2})\s*(박스|box|cs)\.?$/i);
    if (!m) return null; // 한 줄이라도 안 맞으면 LLM 추출로 폴백 (인사말 섞인 원문 등)
    const name = m[1].trim();
    if (name.length < 2 || /^\d+$/.test(name)) return null;
    const n = Math.max(1, parseInt(m[2], 10));
    const isBox = /박스|box|cs/i.test(m[3] || '');
    if (isBox && tab === 'DL') out.push({ name, qty: n, boxes: n });
    else out.push({ name, qty: isBox ? n * 12 : n });
  }
  return out.length > 0 ? out : null;
}

/** ①+③ 전체 파이프라인. fromImage=true면 비전 추출 정형 텍스트로 보고 빠른 파서 우선. */
export async function parseOrderV3(orderText: string, clientCode: string | null, opts?: { fromImage?: boolean; tab?: MatchTab }): Promise<{
  orderLines: V3OrderLine[];
  usage: { input_tokens: number; output_tokens: number };
  historyItemNos: string[];
}> {
  const tab: MatchTab = opts?.tab ?? 'CDV';
  let lines: ExtractedLine[] | null = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  lines = tryFastExtract(orderText, tab); // 정형 발주는 소스 무관 즉시 분리, 안 맞으면 LLM 폴백
  if (!lines) {
    const r = await extractOrderLines(orderText, tab);
    lines = r.lines; usage = r.usage;
  }

  // 임베딩 배치(1회 호출) + 거래처 이력 1회 로드 — 라인별 반복 제거
  const [vecs, history] = await Promise.all([
    lines.length ? embedBatch(lines.map((l) => cleanLineForSearch(l.name))) : Promise.resolve([]),
    loadClientHistory(clientCode, tab),
  ]);
  const results = await Promise.all(lines.map((l, i) =>
    matchLineV3(l.name, clientCode, { queryVec: vecs[i], history, tab })));

  // 후보 품번의 공급가·가용재고 일괄 보강
  const allNos = [...new Set(results.flatMap((r) => r.candidates.map((c) => c.item_no)))];
  const priceMap = new Map<string, { supply_price: number; available_stock: number; units_per_box: number }>();
  const invTable = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';
  for (let i = 0; i < allNos.length; i += 200) {
    const { data } = await supabase.from(invTable)
      .select('item_no, supply_price, available_stock, units_per_box').in('item_no', allNos.slice(i, i + 200));
    for (const r of data || []) {
      priceMap.set(String(r.item_no), {
        supply_price: Number(r.supply_price) || 0,
        available_stock: Number(r.available_stock) || 0,
        units_per_box: Number(r.units_per_box) || 0,
      });
    }
  }

  // 거래처 이력 품번 (메시지 가격 표기·학습용) — 위에서 로드한 history 재사용
  const historyItemNos = [...history.keys()];

  const finalLines = lines;
  const orderLines: V3OrderLine[] = results.map((r, i) => {
    // picked 우선 정렬, 나머지는 final 순 — v2 규약(selectedIdx=0=선택)과 호환
    const rest = r.candidates.filter((c) => c.item_no !== r.picked?.item_no).slice(0, 5);
    const ordered = r.picked ? [r.picked, ...rest] : rest;
    const badge = (no: string) => {
      const isPicked = r.picked?.item_no === no;
      if (!isPicked) return '';
      if (r.decidedBy === 'history') return r.reason || '이력 재주문';
      if (r.reason) return r.reason;
      return r.decidedBy === 'margin' ? '점수 확정' : 'AI 판정';
    };
    // DL 박스 주문 — 본입수 환산. 재고표 units_per_box는 1로 박힌 품목이 많아 신뢰 불가 →
    // v2와 동일 규칙(glassBoxUnits): 레스토랑 시리즈만 공급가 ≤2만=12본입·2만~4만=6본입, 그 외 6 폴백
    const boxes = finalLines[i].boxes;
    let upb = 0;
    if (tab === 'DL' && boxes && r.picked) {
      const info = priceMap.get(r.picked.item_no);
      const ruleUpb = glassBoxUnits(r.picked.item_name, info?.supply_price);
      const invUpb = (info?.units_per_box || 0) > 1 ? info!.units_per_box : 0;
      upb = ruleUpb || invUpb || 6;
    }
    const quantity = tab === 'DL' && boxes ? boxes * upb : finalLines[i].qty;
    const linePrice = finalLines[i].price; // 발주에 병기된 지정 단가 — 선택 후보 가격에 우선
    return {
      query: finalLines[i].name,
      quantity,
      candidates: ordered.map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        confidence: r.picked?.item_no === c.item_no ? r.confidence : Math.min(0.6, c.final),
        supply_price: (linePrice && r.picked?.item_no === c.item_no)
          ? linePrice
          : priceMap.get(c.item_no)?.supply_price || 0,
        available_stock: priceMap.get(c.item_no)?.available_stock || 0,
        reasoning: (linePrice && r.picked?.item_no === c.item_no)
          ? [badge(c.item_no), '지정단가'].filter(Boolean).join(' · ')
          : badge(c.item_no),
      })),
      v3: {
        decidedBy: r.decidedBy, confidence: r.confidence, reason: r.reason,
        picked_in_history: !!r.picked?.in_history, picked_stock: r.picked?.stock ?? 0,
      },
    };
  });

  return { orderLines, usage, historyItemNos: [...new Set(historyItemNos)] };
}
