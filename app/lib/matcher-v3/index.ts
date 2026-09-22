// 매처 v3 — Retrieve(임베딩) → Rank(신호) → Decide(마진/LLM) 3층 구조.
// v2(resolveItemsWeighted)와 병행 비교용. 카탈로그 임베딩은 wine_embeddings(pgvector).
import { supabase } from '../db';
import { getClaudeClient } from '../claudeClient';
import { getEnv } from '../env';
import { toJamo } from './jamo';
import { pipelineStockOf } from '../stock';

export type V3Candidate = {
  item_no: string;
  item_name: string;
  similarity: number;     // 임베딩 코사인 (0~1)
  lexical: number;        // 어휘 일치 (토큰 매칭 비율 0~1) — 짧은 한글 쿼리 보강
  signals: { history: number; vintage: number };
  hist_n?: number;          // 이 거래처 최근 2년 구매 횟수
  stock?: number;           // 파이프라인 재고 (가용+보세+입고예정)
  final: number;
  in_history: boolean;
};

export type V3Result = {
  line: string;
  picked: V3Candidate | null;
  confidence: number;          // 판정 확신도 (마진 기반 또는 LLM)
  decidedBy: 'margin' | 'llm' | 'jev' | 'history' | 'none';
  reason?: string;
  candidates: V3Candidate[];
  timingMs: { embed: number; retrieve: number; rank: number; decide: number };
};

export type MatchTab = 'CDV' | 'DL';
// 법인별 소스 — 와인(CDV)과 글라스(DL)는 테이블·RPC·이력 전부 분리 (법인 분리 원칙)
const SRC = {
  CDV: { inv: 'inventory_cdv', ship: 'shipments', rpcVec: 'match_wines', rpcJamo: 'match_wines_jamo' },
  DL: { inv: 'inventory_dl', ship: 'glass_shipments', rpcVec: 'match_glasses', rpcJamo: 'match_glasses_jamo' },
} as const;

const EMBED_MODEL = 'text-embedding-3-small';
const DECIDE_MODEL = 'claude-haiku-4-5-20251001';
const ESCALATE_MODEL = 'claude-sonnet-4-6'; // Haiku 기권 + 이력 후보 존재 시 재판정

async function embedQuery(text: string): Promise<number[]> {
  return (await embedBatch([text]))[0];
}

/** 배치 임베딩 — 발주 전 라인을 OpenAI 1회 호출로 (라인별 개별 호출 대비 왕복 N-1회 절감) */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEnv('OPENAI_API_KEY')}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`embed failed ${res.status}`);
  const j = await res.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

/** 검색용 정제 문자열 — 배치 임베딩 시 파이프라인이 같은 정제를 써야 벡터가 일치 */
export function cleanLineForSearch(line: string): string {
  return cleanForSearch(line) || line;
}

/** 와인 분류 품번(0~5, A)만 — 글라스·자재·세트 제외. DL은 백화점(ZK)만 제외 */
const WINE_PREFIX = new Set(['0', '1', '2', '3', '4', '5', 'A']);
const isWineItemNo = (no: string) => WINE_PREFIX.has(no.charAt(0).toUpperCase());
const isOrderable = (no: string, tab: MatchTab) =>
  tab === 'DL' ? !no.toUpperCase().startsWith('ZK') : isWineItemNo(no);

/** 검색용 라인 정제 — 수량·단위·말미 숫자 제거 ("뱅상 리자르댕 12" → "뱅상 리자르댕").
 *  숫자가 쿼리에 남으면 임베딩이 "넘버12"류 품목으로 끌려간다. 빈티지 힌트는 정제 전에 추출. */
function cleanForSearch(line: string): string {
  return line
    .replace(/(\d+)\s*(병|개|박스|본|ea|cs|btl)\b/gi, ' ')
    .replace(/(?:^|\s)\d{1,3}(?=\s|$)/g, ' ')   // 단독 1~3자리 숫자(수량) 제거 — 4자리 연도는 유지
    .replace(/["'()!?.,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** 라인에서 빈티지 힌트 추출 (2자리/4자리 연도) */
function vintageHintOf(line: string): string | null {
  const m4 = line.match(/\b(19|20)(\d{2})\b/);
  if (m4) return m4[2];
  const m2 = line.match(/(?:^|[^\d])(\d{2})\s*(?:빈|빈티지|년|vt)/i);
  return m2 ? m2[1] : null;
}
/** 품번 3~4자리 = 빈티지 (extractVintage 규칙과 동일 발상, 간이판) */
function itemVintageOf(itemNo: string): string | null {
  return /^\d{7}$/.test(itemNo) ? itemNo.slice(2, 4) : null;
}

/** 거래처 구매 이력 전체(최근 24개월, 와인만) — 빈도 0~1 + 품명. 후보 선제 주입용. */
export async function loadClientHistory(clientCode: string | null, tab: MatchTab = 'CDV'): Promise<Map<string, { name: string; freq: number; n: number }>> {
  const map = new Map<string, { name: string; freq: number; n: number }>();
  if (!clientCode) return map;
  const cutoff = new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from(SRC[tab].ship)
    .select('item_no, item_name')
    .eq('client_code', clientCode).gte('ship_date', cutoff).limit(3000);
  const freq = new Map<string, { name: string; n: number }>();
  for (const s of data || []) {
    const no = String(s.item_no || '');
    if (!isOrderable(no, tab)) continue;
    const cur = freq.get(no);
    freq.set(no, { name: cur?.name || String(s.item_name || ''), n: (cur?.n || 0) + 1 });
  }
  const max = Math.max(1, ...[...freq.values()].map((v) => v.n));
  for (const [k, v] of freq) map.set(k, { name: v.name, freq: v.n / max, n: v.n });
  return map;
}

/** JS 자모 trigram — 쿼리 커버리지 방식 (pg_trgm word_similarity와 동일 발상).
 *  Jaccard는 "짧은 쿼리 vs 긴 품명"에서 합집합이 커져 무조건 낮게 나옴 → 쿼리 그램이
 *  품명에 얼마나 포함되는지(inter/|query|)로 측정. */
function jamoTrgmSim(query: string, target: string): number {
  const grams = (s: string) => {
    const g = new Set<string>();
    const t = `  ${s} `;
    for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3));
    return g;
  };
  const A = grams(query), B = grams(target);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / A.size;
}

/** LLM 판정 — 후보 중 하나 선택 (구조화 출력). 애매한 꼬리에만 호출. */
async function decideWithLlm(line: string, cands: V3Candidate[], model = DECIDE_MODEL, tab: MatchTab = 'CDV'): Promise<{ item_no: string | null; confidence: number; reason: string }> {
  const claude = getClaudeClient();
  const resp = await claude.messages.create({
    model,
    max_tokens: 200,
    temperature: 0, // 판정 일관성 — 같은 입력에 실행마다 다른 결과가 나오면 안 됨
    tools: [{
      name: 'pick',
      description: '발주 라인에 해당하는 와인 선택',
      input_schema: {
        type: 'object',
        properties: {
          item_no: { type: ['string', 'null'], description: '선택한 품번. 후보 중 정답이 없으면 null' },
          confidence: { type: 'number', description: '확신도 0~1' },
          reason: { type: 'string', description: '한 줄 근거' },
        },
        required: ['item_no', 'confidence', 'reason'],
      },
    }],
    tool_choice: { type: 'tool', name: 'pick' },
    messages: [{
      role: 'user',
      content: `${tab === 'DL' ? '리델 글라스' : '와인'} 발주 라인: "${line}"\n\n후보 목록:\n${cands.map((c, i) =>
        `${i + 1}. [${c.item_no}] ${c.item_name}${c.in_history ? ` (이 거래처 최근 2년 ${c.hist_n || 1}회 구매)` : ''}`).join('\n')}\n\n이 라인이 가리키는 와인을 골라. 규칙: ① 빈티지 숫자·약어·생산자에 주의 ② 같은 와인이 빈티지만 다르게 여럿이면(품번 3~4자리=빈티지) 라인에 빈티지 명시가 없는 한 최신 빈티지를 골라 ③ 띄어쓰기·표기 차이("레끌루"="레 끌루")나 가벼운 오타("레긔에뜨"="레귀에뜨")는 같은 와인으로 인정 ④ 발주는 대부분 재주문이다 — 구매이력 후보의 생산자/핵심 이름이 라인과 통하면 반드시 그것을 골라라 (라인의 '샴페인·레드·화이트' 같은 종류 단어는 품명에 없어도 무시) ⑤ 하지만 실제로 다른 와인/다른 생산자인데 "그나마 비슷한 것"을 고르는 것은 오답 — 그땐 반드시 item_no=null.`,
    }],
  });
  const tool = resp.content.find((c) => c.type === 'tool_use');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inp: any = tool && 'input' in tool ? tool.input : {};
  return { item_no: inp.item_no ?? null, confidence: Number(inp.confidence) || 0, reason: String(inp.reason || '') };
}

/** Jev(TypeSafe AI) 판정 어댑터 — 결정 전용 모델. JEV_API_KEY 설정 시에만 활성.
 *  보정된 확률로 후보 중 선택. 한국어 성능은 A/B로 검증 후 기본값 전환 판단. */
async function decideWithJev(line: string, cands: V3Candidate[]): Promise<{ item_no: string | null; confidence: number; reason: string } | null> {
  const key = process.env.JEV_API_KEY;
  if (!key) return null; // 미연결 — 호출 경로(웨이트리스트/게이트웨이 키) 확보 전
  try {
    const res = await fetch('https://api.jevai.net/v1/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        input: `와인 발주 라인: "${line}" — 이 라인이 가리키는 와인은?`,
        decision: {
          type: 'choice',
          options: [...cands.map((c) => `[${c.item_no}] ${c.item_name}${c.in_history ? ' (구매이력)' : ''}`), '해당 없음'],
        },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const idx = Number(j?.choice_index ?? j?.decision?.index ?? -1);
    const prob = Number(j?.probability ?? j?.confidence ?? 0);
    if (idx < 0 || idx >= cands.length) return { item_no: null, confidence: prob, reason: 'jev: 해당 없음' };
    return { item_no: cands[idx].item_no, confidence: prob, reason: 'jev 판정' };
  } catch { return null; }
}

const W = { sim: 0.30, lex: 0.45, history: 0.18, vintage: 0.07 }; // 어휘(trgm) 주신호 — 골든셋 백테스트로 조정 예정
const AUTO_MARGIN = 0.12;   // top1-top2 격차가 이 이상이면 LLM 없이 확정
const AUTO_FLOOR = 0.55;    // 최소 점수

/** 어휘 검색 — 두 신호의 max:
 *  ① 자모 trgm (오타 '리자르댕'→'지라르댕', 띄어쓰기 '레끌루'→'레 끌루')
 *  ② 토큰 포함 비율 (비연속 토큰 '누나'+'말벡' → '차카나 누나 에스테이트 말벡')
 *  짧은 한글 쿼리에서 임베딩(sim ~0.4대)보다 변별력이 좋아 주 신호로 쓴다. */
async function lexicalRetrieve(line: string, limit = 15, tab: MatchTab = 'CDV'): Promise<Map<string, { item_name: string; lex: number }>> {
  const out = new Map<string, { item_name: string; lex: number }>();
  const tokens = line.split(/\s+/).filter((t) => t.length >= 2 && !/^\d+$/.test(t));
  const put = (no: string, name: string, lex: number) => {
    const cur = out.get(no);
    if (!cur || lex > cur.lex) out.set(no, { item_name: name, lex });
  };
  const [jamoRes, tokenRes] = await Promise.all([
    supabase.rpc(SRC[tab].rpcJamo, { q_jamo: toJamo(line), match_count: limit }),
    tokens.length
      ? supabase.from(SRC[tab].inv).select('item_no, item_name')
          .not('item_no', 'ilike', 'zk%')
          .or(tokens.map((t) => `item_name.ilike.%${t.replace(/[,%]/g, '')}%`).join(','))
          .limit(200)
      : Promise.resolve({ data: [] as Array<{ item_no: string; item_name: string }> }),
  ]);
  for (const r of jamoRes.data || []) put(String(r.item_no), String(r.item_name || ''), Number(r.lex) || 0);
  for (const r of tokenRes.data || []) {
    const no = String(r.item_no || '');
    if (!isOrderable(no, tab)) continue;
    const name = String(r.item_name || '');
    const hit = tokens.filter((t) => name.includes(t)).length;
    put(no, name, hit / tokens.length);
  }
  return new Map([...out.entries()].sort((a, b) => b[1].lex - a[1].lex).slice(0, limit + 5));
}

export type MatchOpts = {
  topK?: number;
  noLlm?: boolean;
  /** 법인 — CDV(와인, 기본) | DL(글라스) */
  tab?: MatchTab;
  /** 사전 계산 쿼리 임베딩 — 발주 파이프라인이 전 라인을 한 번에 배치 임베딩해 전달 */
  queryVec?: number[];
  /** 사전 로드된 거래처 이력 — 라인마다 같은 이력을 반복 조회하지 않게 */
  history?: Awaited<ReturnType<typeof loadClientHistory>>;
};

export async function matchLineV3(line: string, clientCode: string | null, opts?: MatchOpts): Promise<V3Result> {
  const tab: MatchTab = opts?.tab ?? 'CDV';
  const t0 = Date.now();
  const vHintRaw = tab === 'CDV' ? vintageHintOf(line) : null; // 글라스는 빈티지 개념 없음
  const q = cleanForSearch(line) || line;
  const vec = opts?.queryVec ?? await embedQuery(q);
  const t1 = Date.now();

  const [{ data: hits, error }, lexHits] = await Promise.all([
    supabase.rpc(SRC[tab].rpcVec, { query_embedding: JSON.stringify(vec), match_count: opts?.topK ?? 15 }),
    lexicalRetrieve(q, 15, tab),
  ]);
  if (error) throw new Error(error.message);
  const t2 = Date.now();

  type Hit = { item_no: string; item_name: string; similarity: number };
  const rows = (hits || []) as Hit[];
  // 벡터·어휘 결과 병합 (어휘 단독 히트도 후보로)
  const merged = new Map<string, { item_name: string; sim: number; lex: number }>();
  for (const r of rows) merged.set(String(r.item_no), { item_name: r.item_name, sim: r.similarity, lex: 0 });
  for (const [no, l] of lexHits) {
    const cur = merged.get(no);
    if (cur) cur.lex = l.lex;
    else merged.set(no, { item_name: l.item_name, sim: 0, lex: l.lex });
  }
  // 거래처 이력 선제 주입 — 이 집이 사갔던 와인을 쿼리와 직접 대조해 조금이라도 닮았으면 후보로.
  // ("뱅상 리자르댕 12" → 이력의 '뀌베 생 뱅상'이 카탈로그 검색에서 빠졌어도 후보에 올라옴)
  const historyMap = opts?.history ?? await loadClientHistory(clientCode, tab);
  const qJamo = toJamo(q);
  for (const [no, h] of historyMap) {
    const s = jamoTrgmSim(qJamo, toJamo(h.name));
    if (s < 0.15) continue; // 이력 후보는 관대하게 — 최종 판단은 LLM이
    const cur = merged.get(no);
    if (cur) cur.lex = Math.max(cur.lex, s);
    else merged.set(no, { item_name: h.name, sim: 0, lex: s });
  }
  const vHint = vHintRaw;

  // 재고 필터 — 재고 0 카탈로그 노이즈(LJ 부르고뉴 등)는 제외하되,
  // 이력 후보는 보존한다 ("그 와인이 맞는데 품절" → 아래에서 신빈티지 스왑).
  const stockMap = new Map<string, number>();
  {
    const nos = [...merged.keys()];
    for (let i = 0; i < nos.length; i += 200) {
      if (tab === 'CDV') {
        const { data: st } = await supabase.from('inventory_cdv')
          .select('item_no, stock_pipeline').in('item_no', nos.slice(i, i + 200));
        for (const r of st || []) stockMap.set(String(r.item_no), Number(r.stock_pipeline) || 0);
      } else {
        // DL엔 생성 컬럼이 없음 — 원시 컬럼으로 계산 (stock.ts pipelineStockOf 단일 정의)
        const { data: st } = await supabase.from('inventory_dl')
          .select('item_no, available_stock, bonded_warehouse, bonded_kctc, incoming_stock').in('item_no', nos.slice(i, i + 200));
        for (const r of st || []) stockMap.set(String(r.item_no), pipelineStockOf(r));
      }
    }
    for (const no of nos) {
      if ((stockMap.get(no) || 0) <= 0 && !historyMap.has(no)) merged.delete(no);
    }
  }

  const candidates: V3Candidate[] = [...merged.entries()].map(([no, m]) => {
    const h = historyMap.get(no)?.freq || 0;
    const iv = itemVintageOf(no);
    const v = vHint && iv ? (iv === vHint ? 1 : -0.5) : 0; // 빈티지 명시 시 일치 가산·불일치 감점
    const final = W.sim * m.sim + W.lex * m.lex + W.history * h + W.vintage * Math.max(v, 0) + (v < 0 ? -0.05 : 0);
    return { item_no: no, item_name: m.item_name, similarity: m.sim, lexical: m.lex, signals: { history: h, vintage: v }, hist_n: historyMap.get(no)?.n, stock: stockMap.get(no) || 0, final, in_history: h > 0 };
  }).sort((a, b) => b.final - a.final);
  const t3 = Date.now();

  let picked: V3Candidate | null = null;
  let decidedBy: V3Result['decidedBy'] = 'none';
  let confidence = 0;
  let reason: string | undefined;

  const [c1, c2] = candidates;
  // LLM 게이트: 유사도·어휘 어느 쪽도 최소선을 못 넘는 후보뿐이면 LLM에 보내지 않는다.
  // (쓰레기 후보 6개를 주면 LLM이 억지로 하나 고르는 강제선택 환각 — 'RJ인비저블맨' 사고)
  const plausible = candidates.filter((c) =>
    c.similarity >= 0.45 || c.lexical >= 0.35 || (c.in_history && c.lexical >= 0.12));
  if (c1 && c1.final >= AUTO_FLOOR && (!c2 || c1.final - c2.final >= AUTO_MARGIN)) {
    picked = c1; decidedBy = 'margin'; confidence = Math.min(0.99, 0.7 + (c1.final - (c2?.final ?? 0)));
  } else if (plausible.length > 0 && !opts?.noLlm) {
    // 이력 지배 규칙 — 이 거래처가 사온 와인 중 라인과 강하게 닮은 게 정확히 하나면 LLM 없이 그것.
    // ("뱅상 리자르댕 12" — 이 집이 사온 VG 와인이 '퀴베 생 뱅상' 하나뿐이면 재주문으로 판정)
    const histStrong = plausible.filter((c) => c.in_history && c.lexical >= 0.4);
    if (histStrong.length === 1) {
      // 이력 지배 — 조기 반환하지 않고 아래 품절 스왑까지 통과시킨다
      picked = histStrong[0]; decidedBy = 'history';
      confidence = 0.8; reason = `이력 재주문 (최근 2년 ${histStrong[0].hist_n || 1}회)`;
    } else {
      // 1차: Jev(연결돼 있으면) — 보정 확률 0.9 이상만 신뢰, 아니면 LLM으로
      const jev = await decideWithJev(line, plausible.slice(0, 8));
      if (jev && jev.item_no && jev.confidence >= 0.9) {
        decidedBy = 'jev'; confidence = jev.confidence; reason = jev.reason;
        picked = candidates.find((c) => c.item_no === jev.item_no) || null;
      } else {
        let llm = await decideWithLlm(line, plausible.slice(0, 8), DECIDE_MODEL, tab);
        // Haiku 기권 + 이력 후보 존재 → 상위 모델 재판정 (재주문 패턴은 이력이 결정적인데 Haiku가 과하게 보수적)
        if (!llm.item_no && plausible.some((c) => c.in_history)) {
          llm = await decideWithLlm(line, plausible.slice(0, 8), ESCALATE_MODEL, tab);
        }
        decidedBy = 'llm'; confidence = llm.confidence; reason = llm.reason;
        picked = llm.item_no ? candidates.find((c) => c.item_no === llm.item_no) || null : null;
      }
    }
  }
  // 품절 스왑 — 고른 와인이 재고 0이면 같은 베이스 품번(빈티지만 다름)의 재고 있는 최신 빈티지로 교체
  if (tab === 'CDV' && picked && (picked.stock ?? 0) <= 0 && /^\d{7}$/.test(picked.item_no)) {
    const base = picked.item_no.slice(0, 2) + picked.item_no.slice(4);
    const { data: sib } = await supabase.from('inventory_cdv')
      .select('item_no, item_name, stock_pipeline')
      .like('item_no', `${picked.item_no.slice(0, 2)}__${picked.item_no.slice(4)}`)
      .gt('stock_pipeline', 0).limit(10);
    const pickedJamo = toJamo(picked.item_name);
    const alts = (sib || [])
      .filter((r) => String(r.item_no) !== picked!.item_no
        && (String(r.item_no).slice(0, 2) + String(r.item_no).slice(4)) === base
        && jamoTrgmSim(pickedJamo, toJamo(String(r.item_name))) >= 0.7) // 베이스 충돌(다른 와인) 방지
      .sort((a, b) => String(b.item_no).localeCompare(String(a.item_no)));
    if (alts.length > 0) {
      const alt = alts[0];
      reason = `${reason ? reason + ' · ' : ''}이력 빈티지 품절 → 신빈티지 대체`;
      picked = { ...picked, item_no: String(alt.item_no), item_name: String(alt.item_name), stock: Number(alt.stock_pipeline) || 0 };
    } else {
      reason = `${reason ? reason + ' · ' : ''}⚠️ 품절 (대체 빈티지 없음)`;
    }
  }
  const t4 = Date.now();

  return {
    line, picked, confidence, decidedBy, reason, candidates: candidates.slice(0, 8),
    timingMs: { embed: t1 - t0, retrieve: t2 - t1, rank: t3 - t2, decide: t4 - t3 },
  };
}
