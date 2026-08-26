import { supabase } from './db';
import { fetchAllRows } from './fetchAll';

// 발주 텍스트 → 거래처 후보 추천 (담당자 최근 60일 출고 기준).
// order-v2 추천 칩과 텔레그램 발주 봇이 공유하는 단일 소스.
// 점수 = (발주 라인 품목이 실제 나갔던 거래처 가점 ×100) + 출고 거래일수(빈도).

const STOP_TOKENS = new Set(['병', '개', '박스', '케이스', 'cs', 'ea', 'btl', '발주', '부탁드립니다', '부탁드려요', '주세요', '보내주세요', '안녕하세요']);

/** 발주 라인 → 의미 토큰 추출 (숫자·수량단위 제거, 2자+ 한글/영문) */
function lineTokens(line: string): string[] {
  return line.toLowerCase()
    .replace(/[0-9]+(병|개|박스|케이스|cs|ea|btl)?/g, ' ')
    .split(/[\s,./()"'x×*-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t));
}

export interface SuggestedClient { client_code: string; client_name: string }

/**
 * 발주 라인 토큰(3자+ 1개 또는 2개 이상)이 출고 품명에 들어 있으면 그 거래처를 품목 매칭으로 가점.
 * 품목 힌트가 없으면 60일 출고 거래일수(빈도) 순.
 */
export async function candidateClients(
  manager: string, orderText: string, opts?: { tab?: 'CDV' | 'DL'; limit?: number },
): Promise<SuggestedClient[]> {
  const limit = opts?.limit ?? 6;
  const table = opts?.tab === 'DL' ? 'glass_shipments' : 'shipments';
  const since = new Date(Date.now() + 9 * 3600 * 1000 - 60 * 86400000).toISOString().slice(0, 10);
  const ships = await fetchAllRows<{ client_code: string; client_name: string; item_name: string | null; ship_date: string }>((f, t) =>
    supabase.from(table)
      .select('client_code, client_name, item_name, ship_date')
      .eq('manager', manager).gte('ship_date', since)
      .order('ship_date', { ascending: false }).range(f, t));

  const lines = orderText.split('\n').map(lineTokens).filter((ts) => ts.length > 0);

  type Cand = { client_name: string; itemHits: number; days: Set<string>; lastDate: string };
  const byClient = new Map<string, Cand>();
  const lineHitByClient = new Map<string, Set<number>>(); // 같은 라인 중복 가점 방지

  for (const s of ships) {
    const code = String(s.client_code || '');
    if (!code || !s.client_name) continue;
    let c = byClient.get(code);
    if (!c) { c = { client_name: String(s.client_name), itemHits: 0, days: new Set(), lastDate: s.ship_date }; byClient.set(code, c); }
    c.days.add(s.ship_date);

    const itemName = String(s.item_name || '').toLowerCase().replace(/\s+/g, '');
    if (!itemName) continue;
    lines.forEach((tokens, li) => {
      const hit = lineHitByClient.get(code);
      if (hit?.has(li)) return;
      const matched = tokens.filter((t) => itemName.includes(t.replace(/\s+/g, '')));
      const strong = matched.some((t) => t.length >= 3) || matched.length >= 2;
      if (strong) {
        c!.itemHits += 1;
        if (!lineHitByClient.has(code)) lineHitByClient.set(code, new Set());
        lineHitByClient.get(code)!.add(li);
      }
    });
  }

  return [...byClient.entries()]
    .map(([client_code, c]) => ({
      client_code, client_name: c.client_name,
      score: c.itemHits * 100 + c.days.size,
      lastDate: c.lastDate,
    }))
    .sort((a, b) => b.score - a.score || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map(({ client_code, client_name }) => ({ client_code, client_name }));
}
