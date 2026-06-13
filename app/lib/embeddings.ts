// Voyage AI 임베딩 유틸 (발주 후보 사전축소 / Phase 2).
//
// Anthropic 추천 임베딩. voyage-4-lite(저비용, 한국어/로마자 혼용 우수).
// document/query 비대칭 입력 지원(검색 정확도↑).
// 모델/차원 교체 시 EMBED_MODEL·EMBED_DIM 만 변경 + DB 벡터 차원 동기화.

export const EMBED_MODEL = "voyage-4-lite";
export const EMBED_DIM = 1024;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export type InputType = "document" | "query";

async function voyageEmbed(inputs: string[], inputType: InputType): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY 가 설정되지 않았습니다 (임베딩 필요).");

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      input_type: inputType,
      output_dimension: EMBED_DIM,
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  // OpenAI 호환: { data: [{ embedding, index }] }
  const data = (json.data || []) as Array<{ embedding: number[]; index: number }>;
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** 품목 → 임베딩 입력 텍스트. 품명 + 국가(맥락)로 검색 정확도를 약간 높인다. */
export function buildItemContent(itemName: string, country?: string | null): string {
  const name = (itemName || "").trim();
  const c = (country || "").trim();
  return c ? `${name} · ${c}` : name;
}

/** 단일 텍스트 임베딩 (기본 query — 발주문 검색용) */
export async function embedText(text: string, inputType: InputType = "query"): Promise<number[]> {
  const [v] = await embedTexts([text], inputType);
  return v;
}

/** 배치 임베딩 (Voyage 한 요청당 최대 1000개; 안전하게 분할) */
export async function embedTexts(
  texts: string[],
  inputType: InputType = "document",
  batchSize = 128,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize).map((t) => (t && t.trim()) || " ");
    out.push(...(await voyageEmbed(chunk, inputType)));
  }
  return out;
}
