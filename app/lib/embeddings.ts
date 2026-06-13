// OpenAI 임베딩 유틸 (발주 후보 사전축소 / Phase 2).
//
// text-embedding-3-small (1536차원). 한국어/로마자 혼용 와인명에 충분.
// 더 높은 정확도가 필요하면 EMBED_MODEL 만 -large 또는 Voyage 로 교체(차원 동기화 필요).

import OpenAI from "openai";

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIM = 1536;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다 (임베딩 필요).");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** 품목 → 임베딩 입력 텍스트. 품명 + 국가(맥락) 로 검색 정확도를 약간 높인다. */
export function buildItemContent(itemName: string, country?: string | null): string {
  const name = (itemName || "").trim();
  const c = (country || "").trim();
  return c ? `${name} · ${c}` : name;
}

/** 단일 텍스트 임베딩 */
export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/**
 * 배치 임베딩. OpenAI 는 한 요청에 다수 입력 가능(대용량은 분할).
 * 입력 순서와 동일한 순서로 벡터 배열 반환.
 */
export async function embedTexts(texts: string[], batchSize = 256): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize).map((t) => (t && t.trim()) || " ");
    const res = await client().embeddings.create({ model: EMBED_MODEL, input: chunk });
    // res.data 는 index 순서 보장
    for (const d of res.data) out.push(d.embedding as number[]);
  }
  return out;
}
