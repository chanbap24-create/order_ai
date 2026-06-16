// 추천 견적: 규칙기반 후보 + LLM 취향매칭 선택/사유 (하이브리드).
// LLM 은 "주어진 후보 item_code 안에서만" 고르므로 재고/가격 창작 불가.
import { supabase } from '@/app/lib/db';
import { getClaudeClient } from '@/app/lib/claudeClient';
import type { ScoredItem } from '@/app/sales/recommend/types';
import { buildCandidates, type CandidateContext } from './buildCandidates';

// 비용 우선: 후보가 이미 규칙으로 선별돼 있어 Haiku 로 충분(선택+짧은 사유).
const MODEL = 'claude-haiku-4-5-20251001';
const CANDIDATE_N = 24; // LLM 에 제시할 후보 수 (프롬프트 비용 직결)
const RECENT_N = 15; // 취향 프로파일에 넣을 최근 구매 와인 수
const NOTE_MAX = 140; // 노트 표기 최대 길이
const NOTE_BATCH = 400;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoteRow = Record<string, any>;

async function fetchNotes(codes: string[]): Promise<Map<string, NoteRow>> {
  const map = new Map<string, NoteRow>();
  const uniq = Array.from(new Set(codes.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += NOTE_BATCH) {
    const { data } = await supabase
      .from('tasting_notes')
      .select('wine_id, color_note, nose_note, palate_note, grape_varieties, region, wine_type, winemaking')
      .in('wine_id', uniq.slice(i, i + NOTE_BATCH));
    for (const n of (data || []) as NoteRow[]) map.set(n.wine_id, n);
  }
  return map;
}

const noteStr = (notes: Map<string, NoteRow>, code: string): string => {
  const n = notes.get(code);
  if (!n) return '';
  return [n.color_note, n.nose_note, n.palate_note].filter(Boolean).join(' / ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
};

export interface LlmQuoteResult {
  client: CandidateContext['client'];
  recommendations: ScoredItem[];
  summary: CandidateContext['summary'];
  comment: string;
  model: string;
}

export async function buildLlmQuote(clientCode: string, pickCount = 10): Promise<LlmQuoteResult> {
  const ctx = await buildCandidates(clientCode);
  const candidates = ctx.scored.slice(0, CANDIDATE_N);

  // 후보 + 최근구매 와인의 테이스팅 노트
  const notes = await fetchNotes([...candidates.map((c) => c.item_no), ...ctx.recentCodes]);

  const recentLines = ctx.recentCodes.slice(0, RECENT_N).map((code) => {
    const w = ctx.wineMap.get(code);
    const name = w ? (w.item_name_kr || w.item_name_en || code) : code;
    const ns = noteStr(notes, code);
    return `- ${name}${ns ? ` | ${ns}` : ''}`;
  }).join('\n');

  const candLines = candidates.map((c) => {
    const ns = noteStr(notes, c.item_no);
    return `${c.item_no} | ${c.item_name} | ${c.country || ''} ${c.region || ''} | ${c.grape || ''} | ${c.wine_type || ''} | ${(c.price || 0).toLocaleString()}원${ns ? ` | ${ns}` : ''}`;
  }).join('\n');

  const system = `너는 와인 영업 전문가다. 거래처가 최근 구매한 와인(맛 프로파일 포함)과 "현재 재고 후보 목록"을 보고, 이 거래처에 보낼 추천 견적을 구성한다.
규칙:
- 반드시 후보 목록의 item_code 중에서만 고른다. 목록에 없는 품목/가격을 만들지 마라.
- 거래처의 취향(품종·산지·스타일·맛 프로파일·가격대)과 잘 맞는 순으로 최대 ${pickCount}개.
- 다양성 고려(똑같은 것만 X). 취향에서 크게 벗어나지 않는 선에서 새 제안도 일부 포함.
- 각 추천에 한국어 한 문장 사유(거래처가 즐긴 와인/취향과 연결해 구체적으로). 가격·재고 수치는 쓰지 마라(데이터로 채운다).
- comment: 이 구성을 제안하는 이유 2문장(영업담당이 거래처에 말하듯).
JSON만 출력:
{"picks":[{"item_code":"품번","reason":"사유"}],"comment":"전체 코멘트"}`;

  const prefLine = [...ctx.summary.top_countries, ...ctx.summary.top_grapes, ...ctx.summary.top_types]
    .filter(Boolean).slice(0, 6).join(', ');
  const user = `[거래처] ${ctx.client.name} (${ctx.client.business_type || '-'}) · 평균단가 ${ctx.summary.avg_price.toLocaleString()}원 · 선호 ${prefLine || '데이터 적음'}
[최근 6개월 구매 와인]
${recentLines || '(최근 구매 이력이 적습니다)'}

[현재 재고 후보] item_code | 품명 | 산지 | 품종 | 타입 | 가격 | 맛(색/향/맛)
${candLines}`;

  let picks: Array<{ item_code?: string; reason?: string }> = [];
  let comment = '';
  try {
    const claude = getClaudeClient();
    const resp = await claude.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const o = JSON.parse(m[0]);
      picks = Array.isArray(o.picks) ? o.picks : [];
      comment = typeof o.comment === 'string' ? o.comment : '';
    }
  } catch (e) {
    console.error('[llm-quote] LLM 실패, 규칙기반 폴백:', e instanceof Error ? e.message : e);
  }

  // 검증: 후보 안의 item_code 만 채택, LLM 사유로 교체
  const candMap = new Map(candidates.map((c) => [c.item_no, c]));
  const recommendations: ScoredItem[] = [];
  for (const p of picks) {
    const code = String(p.item_code || '').trim();
    const c = candMap.get(code);
    if (!c || recommendations.some((r) => r.item_no === code)) continue;
    recommendations.push({
      ...c,
      reason: String(p.reason || c.reason || '').trim() || c.reason,
      tags: Array.from(new Set([...(c.tags || []), 'AI추천'])),
    });
    if (recommendations.length >= pickCount) break;
  }
  // LLM 결과가 비면 규칙 상위로 폴백
  if (recommendations.length === 0) {
    recommendations.push(...candidates.slice(0, Math.min(pickCount, 8)));
    if (!comment) comment = '최근 구매 이력과 재고를 바탕으로 한 추천입니다.';
  }

  return { client: ctx.client, recommendations, summary: ctx.summary, comment, model: MODEL };
}
