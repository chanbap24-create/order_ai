// 발주 v3 파이프라인: ① Claude 추출(와인 라인·수량만) → ③ matchLineV3 라인별 매칭.
// 응답은 v2 OrderLine 호환 형태 — 메시지 빌더(staffMessage)·학습(learnOrderCorrections) 재사용을 위해.
import { supabase } from '../db';
import { getClaudeClient } from '../claudeClient';
import { matchLineV3, type V3Result } from './index';

const EXTRACT_MODEL = 'claude-haiku-4-5-20251001';

export type ExtractedLine = { name: string; qty: number };

/** ① 추출 — 자유 발주 텍스트에서 와인 라인만 분리. 인사말·질문·요청사항은 버린다. */
export async function extractOrderLines(orderText: string): Promise<{ lines: ExtractedLine[]; usage: { input_tokens: number; output_tokens: number } }> {
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
                name: { type: 'string', description: '와인 이름 부분 (수량·단위 제외, 원문 표기 유지)' },
                qty: { type: 'number', description: '수량(병). 박스/케이스는 12병, 반박스 6병. 미표기는 1' },
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
      content: `다음 와인 발주 텍스트에서 주문 라인만 추출해.\n규칙: ① 인사말·감사 인사·질문·자료 요청("카탈로그 보내주세요" 등)·배송 요청사항은 라인이 아님 ② 한 줄에 여러 와인이 있으면 분리 ③ 수량 단위: 병=1, 박스/케이스/CS=12병, 반박스=6병 ④ 이름 뒤 2자리 숫자+"빈"은 빈티지이므로 이름에 포함(수량 아님) ⑤ 이름은 원문 표기 그대로(오타 수정 금지).\n\n발주 텍스트:\n"""\n${orderText}\n"""`,
    }],
  });
  const tool = resp.content.find((c) => c.type === 'tool_use');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inp: any = tool && 'input' in tool ? tool.input : {};
  const lines: ExtractedLine[] = Array.isArray(inp.lines)
    ? inp.lines
        .map((l: { name?: unknown; qty?: unknown }) => ({ name: String(l.name || '').trim(), qty: Math.max(1, Math.trunc(Number(l.qty) || 1)) }))
        .filter((l: ExtractedLine) => l.name.length >= 2)
        .slice(0, 30)
    : [];
  return { lines, usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens } };
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

/** ①+③ 전체 파이프라인 */
export async function parseOrderV3(orderText: string, clientCode: string | null): Promise<{
  orderLines: V3OrderLine[];
  usage: { input_tokens: number; output_tokens: number };
  historyItemNos: string[];
}> {
  const { lines, usage } = await extractOrderLines(orderText);

  const results = await Promise.all(lines.map((l) => matchLineV3(l.name, clientCode)));

  // 후보 품번의 공급가·가용재고 일괄 보강
  const allNos = [...new Set(results.flatMap((r) => r.candidates.map((c) => c.item_no)))];
  const priceMap = new Map<string, { supply_price: number; available_stock: number }>();
  for (let i = 0; i < allNos.length; i += 200) {
    const { data } = await supabase.from('inventory_cdv')
      .select('item_no, supply_price, available_stock').in('item_no', allNos.slice(i, i + 200));
    for (const r of data || []) {
      priceMap.set(String(r.item_no), { supply_price: Number(r.supply_price) || 0, available_stock: Number(r.available_stock) || 0 });
    }
  }

  // 거래처 이력 품번 (메시지 가격 표기·학습용)
  const historyItemNos: string[] = [];
  if (clientCode) {
    const { data } = await supabase.from('shipments')
      .select('item_no').eq('client_code', clientCode)
      .gte('ship_date', new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10)).limit(2000);
    for (const r of data || []) historyItemNos.push(String(r.item_no));
  }

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
    return {
      query: lines[i].name,
      quantity: lines[i].qty,
      candidates: ordered.map((c) => ({
        item_no: c.item_no,
        item_name: c.item_name,
        confidence: r.picked?.item_no === c.item_no ? r.confidence : Math.min(0.6, c.final),
        supply_price: priceMap.get(c.item_no)?.supply_price || 0,
        available_stock: priceMap.get(c.item_no)?.available_stock || 0,
        reasoning: badge(c.item_no),
      })),
      v3: {
        decidedBy: r.decidedBy, confidence: r.confidence, reason: r.reason,
        picked_in_history: !!r.picked?.in_history, picked_stock: r.picked?.stock ?? 0,
      },
    };
  });

  return { orderLines, usage, historyItemNos: [...new Set(historyItemNos)] };
}
