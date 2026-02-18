// app/lib/llmReranker.ts
// 로컬 사전 + LLM 폴백 쿼리 확장 + 후보 리랭킹

import { getClaudeClient } from "@/app/lib/claudeClient";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

interface Candidate {
  item_no: string;
  item_name: string;
  score: number;
  supply_price?: number;
  is_new_item?: boolean;
  [key: string]: any;
}

interface RerankResult {
  bestIndex: number;
  confidence: number;
  reasoning: string;
  reranked: Candidate[];
}

interface ExpandResult {
  originalQuery: string;
  expandedQueries: string[];
  wineName: string;
  confidence: number;
}

// ============================================================
// ✅ 로컬 약어 사전 — API 호출 없이 즉시 변환 (0ms)
// ============================================================
const ABBREVIATION_DICT: Record<string, { wineName: string; wineNameEn: string; keywords: string[] }> = {
  // 유명 와인
  "돔페": { wineName: "돔페리뇽", wineNameEn: "Dom Perignon", keywords: ["돔페리뇽", "Dom Perignon", "샴페인"] },
  "돔뻬": { wineName: "돔페리뇽", wineNameEn: "Dom Perignon", keywords: ["돔페리뇽", "Dom Perignon", "샴페인"] },
  "오퍼스": { wineName: "오퍼스원", wineNameEn: "Opus One", keywords: ["오퍼스원", "Opus One", "나파밸리"] },
  "라피": { wineName: "라피트 로칠드", wineNameEn: "Lafite Rothschild", keywords: ["라피트", "Lafite", "보르도"] },
  "라삐": { wineName: "라피트 로칠드", wineNameEn: "Lafite Rothschild", keywords: ["라피트", "Lafite", "보르도"] },
  "무똥": { wineName: "무통 로칠드", wineNameEn: "Mouton Rothschild", keywords: ["무통", "Mouton", "보르도"] },
  "무통": { wineName: "무통 로칠드", wineNameEn: "Mouton Rothschild", keywords: ["무통", "Mouton", "보르도"] },
  "마르고": { wineName: "샤또 마르고", wineNameEn: "Chateau Margaux", keywords: ["마르고", "Margaux", "보르도"] },
  "오브리": { wineName: "오브리옹", wineNameEn: "Haut-Brion", keywords: ["오브리옹", "Haut-Brion", "보르도"] },
  "페트": { wineName: "페트뤼스", wineNameEn: "Petrus", keywords: ["페트뤼스", "Petrus", "포므롤"] },
  "로마콩": { wineName: "로마네 콩티", wineNameEn: "Romanee Conti", keywords: ["로마네콩티", "Romanee Conti", "DRC"] },
  "크룩": { wineName: "크룩", wineNameEn: "Krug", keywords: ["크룩", "Krug", "샴페인"] },
  "뵈브": { wineName: "뵈브 클리코", wineNameEn: "Veuve Clicquot", keywords: ["뵈브클리코", "Veuve Clicquot", "샴페인"] },
  "벨에포크": { wineName: "페리에 주에 벨 에포크", wineNameEn: "Perrier-Jouet Belle Epoque", keywords: ["벨에포크", "Belle Epoque", "페리에주에"] },
  "벨에뽀": { wineName: "페리에 주에 벨 에포크", wineNameEn: "Perrier-Jouet Belle Epoque", keywords: ["벨에포크", "Belle Epoque", "페리에주에"] },
  "앙젤": { wineName: "앙젤뤼스", wineNameEn: "Angelus", keywords: ["앙젤뤼스", "Angelus", "생떼밀리옹"] },
  "슈발블": { wineName: "슈발 블랑", wineNameEn: "Cheval Blanc", keywords: ["슈발블랑", "Cheval Blanc", "생떼밀리옹"] },
  "사시": { wineName: "사시카이아", wineNameEn: "Sassicaia", keywords: ["사시카이아", "Sassicaia", "토스카나"] },
  "안티": { wineName: "안티노리", wineNameEn: "Antinori", keywords: ["안티노리", "Antinori", "티냐넬로"] },
  "펜폴": { wineName: "펜폴즈", wineNameEn: "Penfolds", keywords: ["펜폴즈", "Penfolds", "그란지"] },

  // 품종 약어
  "까쇼": { wineName: "카베르네 소비뇽", wineNameEn: "Cabernet Sauvignon", keywords: ["카베르네 소비뇽", "Cabernet Sauvignon"] },
  "까소": { wineName: "카베르네 소비뇽", wineNameEn: "Cabernet Sauvignon", keywords: ["카베르네 소비뇽", "Cabernet Sauvignon"] },
  "CS": { wineName: "카베르네 소비뇽", wineNameEn: "Cabernet Sauvignon", keywords: ["카베르네 소비뇽", "Cabernet Sauvignon"] },
  "SB": { wineName: "소비뇽 블랑", wineNameEn: "Sauvignon Blanc", keywords: ["소비뇽 블랑", "Sauvignon Blanc"] },
  "PN": { wineName: "피노 누아", wineNameEn: "Pinot Noir", keywords: ["피노 누아", "피노누아", "Pinot Noir"] },
  "피누": { wineName: "피노 누아", wineNameEn: "Pinot Noir", keywords: ["피노 누아", "피노누아", "Pinot Noir"] },
  "샤도": { wineName: "샤르도네", wineNameEn: "Chardonnay", keywords: ["샤르도네", "Chardonnay"] },
  "메를": { wineName: "메를로", wineNameEn: "Merlot", keywords: ["메를로", "Merlot"] },
  "시라": { wineName: "시라", wineNameEn: "Syrah", keywords: ["시라", "쉬라즈", "Syrah", "Shiraz"] },
  "리슬": { wineName: "리슬링", wineNameEn: "Riesling", keywords: ["리슬링", "Riesling"] },
  "말벡": { wineName: "말벡", wineNameEn: "Malbec", keywords: ["말벡", "Malbec"] },
  "그르": { wineName: "그르나슈", wineNameEn: "Grenache", keywords: ["그르나슈", "Grenache", "가르나차"] },
  "템프": { wineName: "템프라니요", wineNameEn: "Tempranillo", keywords: ["템프라니요", "Tempranillo"] },
  "진판": { wineName: "진판델", wineNameEn: "Zinfandel", keywords: ["진판델", "Zinfandel"] },
  "네비": { wineName: "네비올로", wineNameEn: "Nebbiolo", keywords: ["네비올로", "Nebbiolo", "바롤로"] },
  "산지": { wineName: "산지오베제", wineNameEn: "Sangiovese", keywords: ["산지오베제", "Sangiovese"] },

  // 이탈리아 와인 약어
  "rdm": { wineName: "로쏘 디 몬탈치노", wineNameEn: "Rosso di Montalcino", keywords: ["로쏘 디 몬탈치노", "Rosso di Montalcino", "몬탈치노"] },
  "bdm": { wineName: "브루넬로 디 몬탈치노", wineNameEn: "Brunello di Montalcino", keywords: ["브루넬로디몬탈치노", "Brunello di Montalcino", "몬탈치노"] },

  // 지역/타입 약어
  "샤블": { wineName: "샤블리", wineNameEn: "Chablis", keywords: ["샤블리", "Chablis"] },
  "보졸": { wineName: "보졸레", wineNameEn: "Beaujolais", keywords: ["보졸레", "Beaujolais"] },
  "바롤": { wineName: "바롤로", wineNameEn: "Barolo", keywords: ["바롤로", "Barolo"] },
  "바르": { wineName: "바르바레스코", wineNameEn: "Barbaresco", keywords: ["바르바레스코", "Barbaresco"] },
  "브루": { wineName: "브루넬로", wineNameEn: "Brunello", keywords: ["브루넬로", "Brunello", "몬탈치노"] },
  "몽라": { wineName: "몽라셰", wineNameEn: "Montrachet", keywords: ["몽라셰", "Montrachet"] },
  "상떼": { wineName: "상떼밀리옹", wineNameEn: "Saint-Emilion", keywords: ["상떼밀리옹", "Saint-Emilion"] },
  "뽀이": { wineName: "뽀이약", wineNameEn: "Pauillac", keywords: ["뽀이약", "Pauillac"] },
  "뽀이약": { wineName: "뽀이약", wineNameEn: "Pauillac", keywords: ["뽀이약", "Pauillac"] },
  "마르": { wineName: "마르고", wineNameEn: "Margaux", keywords: ["마르고", "Margaux"] },
  "포므": { wineName: "포므롤", wineNameEn: "Pomerol", keywords: ["포므롤", "Pomerol"] },
  "키안": { wineName: "키안티", wineNameEn: "Chianti", keywords: ["키안티", "Chianti"] },
  "리오": { wineName: "리오하", wineNameEn: "Rioja", keywords: ["리오하", "Rioja"] },
  "아마": { wineName: "아마로네", wineNameEn: "Amarone", keywords: ["아마로네", "Amarone"] },

  // 생산자 약어 (재고에 있는 것들)
  "찰하": { wineName: "찰스 하이직", wineNameEn: "Charles Heidsieck", keywords: ["찰스 하이직", "Charles Heidsieck"] },
  "르로아": { wineName: "르로아", wineNameEn: "Leroy", keywords: ["르로아", "Leroy", "도멘 르로아"] },
  "지라르": { wineName: "뱅상 지라르댕", wineNameEn: "Vincent Girardin", keywords: ["지라르댕", "Girardin", "뱅상"] },
  "에밀": { wineName: "에밀리아나", wineNameEn: "Emiliana", keywords: ["에밀리아나", "Emiliana"] },
  "안셀": { wineName: "안셀미", wineNameEn: "Anselmi", keywords: ["안셀미", "Anselmi"] },
  "알테": { wineName: "알테시노", wineNameEn: "Altesino", keywords: ["알테시노", "Altesino"] },
  "수티": { wineName: "수티랑", wineNameEn: "Soutiran", keywords: ["수티랑", "Soutiran"] },

  // 영문 브랜드코드 (재고 품목명 접두사)
  "at": { wineName: "알테시노", wineNameEn: "Altesino", keywords: ["알테시노", "Altesino"] },
  "bs": { wineName: "비온디 산티", wineNameEn: "Biondi-Santi", keywords: ["비온디 산티", "비온디산티", "Biondi-Santi"] },
};

/**
 * 로컬 사전에서 약어 확장 (즉시, 0ms)
 */
export function expandFromDict(query: string): ExpandResult | null {
  const q = query.trim();
  // 대소문자 무시 매칭: 원본 → 소문자 → 대문자 순서로 시도
  const entry = ABBREVIATION_DICT[q] || ABBREVIATION_DICT[q.toLowerCase()] || ABBREVIATION_DICT[q.toUpperCase()];
  if (!entry) return null;

  return {
    originalQuery: q,
    expandedQueries: [entry.wineName, entry.wineNameEn, ...entry.keywords].filter(k => k.length >= 2),
    wineName: entry.wineName,
    confidence: 0.95,
  };
}

// 캐시
const expandCache = new Map<string, { result: ExpandResult; ts: number }>();
const rerankCache = new Map<string, { result: RerankResult; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10분

/**
 * 쿼리 확장: 로컬 사전 우선 → LLM 폴백
 */
export async function expandQueryWithLLM(
  query: string
): Promise<ExpandResult | null> {
  if (!query || query.length < 2) return null;

  // 1) 로컬 사전 (즉시)
  const dictResult = expandFromDict(query);
  if (dictResult) return dictResult;

  // 2) 캐시
  const cacheKey = `expand::${query}`;
  const cached = expandCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result;
  }

  // 3) LLM 폴백 (사전에 없는 경우만)
  try {
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `와인 주문에서 고객이 "${query}"라고 입력했습니다. 이것이 어떤 와인/품종인지 해석해주세요.
search_keywords에는 실제 재고 검색에 도움될 한글/영문 키워드를 넣어주세요.
반드시 JSON만 응답: {"wine_name":"정식명(한글)","wine_name_en":"English name","search_keywords":["키워드1","키워드2","키워드3"],"confidence":0.0-1.0}`
        }
      ],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const result: ExpandResult = {
      originalQuery: query,
      expandedQueries: [
        parsed.wine_name || "",
        parsed.wine_name_en || "",
        ...(parsed.search_keywords || []),
      ].filter((q: string) => q && q.length >= 2),
      wineName: parsed.wine_name || query,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
    };

    expandCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("[LLM Expand] Error:", err);
    return null;
  }
}

/**
 * Claude로 후보 리랭킹
 */
export async function rerankWithLLM(
  query: string,
  candidates: Candidate[],
  context?: { clientName?: string }
): Promise<RerankResult | null> {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) {
    return {
      bestIndex: 0,
      confidence: candidates[0].score,
      reasoning: "후보 1개",
      reranked: candidates,
    };
  }

  const cacheKey = `rerank::${query}::${candidates.map(c => c.item_no).join(",")}`;
  const cached = rerankCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.result;
  }

  try {
    const client = getClaudeClient();
    const candidateList = candidates.slice(0, 8).map((c, i) => {
      const price = c.supply_price ? ` / ${c.supply_price.toLocaleString()}원` : "";
      const badge = c.is_new_item ? " [신규]" : "";
      return `${i + 1}. [${c.item_no}] ${c.item_name}${price}${badge} (점수: ${(c.score ?? 0).toFixed(2)})`;
    }).join("\n");

    const contextStr = context?.clientName ? `\n거래처: ${context.clientName}` : "";

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `고객이 "${query}"를 주문했습니다.${contextStr}

후보:
${candidateList}

가장 일치하는 후보를 선택하세요. 없으면 best=0.
JSON만: {"best":번호(0=없음,1-${Math.min(candidates.length, 8)}),"confidence":0.0-1.0,"reason":"이유"}`
        }
      ],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const bestNum = parsed.best || 0;
    const confidence = Math.max(0, Math.min(1, parsed.confidence || 0));
    const reasoning = String(parsed.reason || "").slice(0, 100);

    if (bestNum === 0 || confidence < 0.3) return null;

    const bestIdx = Math.max(0, Math.min(bestNum - 1, candidates.length - 1));
    const reranked = [...candidates];
    if (bestIdx !== 0) {
      const [picked] = reranked.splice(bestIdx, 1);
      reranked.unshift(picked);
    }

    reranked[0] = {
      ...reranked[0],
      score: Math.max(reranked[0].score, confidence),
      llm_confidence: confidence,
      llm_reason: reasoning,
    };

    const result: RerankResult = { bestIndex: bestIdx, confidence, reasoning, reranked };
    rerankCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("[LLM Rerank] Error:", err);
    return null;
  }
}

/**
 * 리랭킹이 필요한지 (점수가 애매할 때)
 */
export function needsReranking(candidates: Candidate[]): boolean {
  if (!candidates || candidates.length < 2) return false;
  const top = candidates[0]?.score ?? 0;
  const second = candidates[1]?.score ?? 0;
  const gap = top - second;

  if (top >= 0.85 && gap >= 0.15) return false;
  if (top < 0.3) return false;
  return true;
}
