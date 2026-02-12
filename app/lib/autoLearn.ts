/**
 * ========================================
 * 자동 학습 시스템 (Auto Learning)
 * ========================================
 *
 * 사용자가 후보를 선택하면 자동으로:
 * 1. 토큰 매핑 학습 (ch → 찰스하이직)
 * 2. ML 학습 데이터 수집 (PyTorch 준비)
 */

import { supabase } from "@/app/lib/db";

/* ==================== 유틸리티 ==================== */

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * 한글 초성 추출
 */
function extractConsonants(text: string): string {
  let consonants = '';
  for (const char of text) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const chosungIndex = Math.floor(code / 588);
      consonants += CHOSUNG[chosungIndex];
    }
  }
  return consonants;
}

/**
 * 수량/단위 제거
 */
function stripQtyAndUnit(raw: string): string {
  let s = String(raw || "").trim();
  s = s.replace(/\b(\d+)\s*(병|박스|cs|box|bt|btl)\b/gi, "").trim();
  s = s.replace(/\b\d+\b\s*$/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * 입력을 토큰으로 분해
 */
function extractTokens(text: string): string[] {
  const normalized = stripQtyAndUnit(text);
  return normalized
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * 품목명에서 핵심 키워드 추출
 */
function extractKeywords(itemName: string): {
  producer: string | null;
  varietal: string | null;
  vintage: string | null;
  raw: string;
} {
  // "3A24401 찰스하이직 샤르도네 2022" 형태
  let s = itemName.replace(/^[\dA-Z]+\s+/, ''); // 품목번호 제거

  // 빈티지 추출 (4자리 연도)
  const vintageMatch = s.match(/\b(19|20)\d{2}\b/);
  const vintage = vintageMatch ? vintageMatch[0] : null;
  if (vintage) {
    s = s.replace(vintage, '').trim();
  }

  // 토큰 분해
  const tokens = s.split(/\s+/).filter(Boolean);

  // 일반적으로 첫 번째 토큰은 생산자, 두 번째는 품종
  const producer = tokens[0] || null;
  const varietal = tokens[1] || null;

  return { producer, varietal, vintage, raw: s };
}

/* ==================== 매핑 감지 ==================== */

/**
 * 토큰이 생산자 약어인지 감지
 */
function isProducerAbbreviation(token: string, producer: string | null): boolean {
  if (!producer || !token) return false;

  const t = token.toLowerCase().replace(/\s+/g, '');
  const p = producer.toLowerCase().replace(/\s+/g, '');

  // 너무 짧으면 거짓 양성
  if (t.length < 2) return false;

  // 1. 영문 이니셜? (ch → Charles Heidsieck)
  if (/^[a-z]+$/.test(t)) {
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const initials = words.map(w => w[0]).join('');
      if (t === initials) return true;
    }

    // 단일 단어의 앞 글자들?
    if (p.startsWith(t)) return true;
  }

  // 2. 한글 초성? (ㅊㅎㅈ → 찰스하이직)
  const consonants = extractConsonants(p);
  if (consonants && t === consonants.toLowerCase()) return true;

  // 3. 부분 매칭? (찰스 → 찰스하이직)
  if (p.includes(t) && t.length >= 2) return true;

  return false;
}

/**
 * 토큰이 품종 약어인지 감지
 */
function isVarietalAbbreviation(token: string, varietal: string | null): boolean {
  if (!varietal || !token) return false;

  const t = token.toLowerCase().replace(/\s+/g, '');
  const v = varietal.toLowerCase().replace(/\s+/g, '');

  // 너무 짧으면 거짓 양성
  if (t.length < 2) return false;

  // 알려진 약어 매핑
  const knownAbbreviations: Record<string, string[]> = {
    '샤르도네': ['샤도', '샤도네', 'chard', 'chardonnay'],
    '카베르네소비뇽': ['까베', '카베', 'cab', 'cs'],
    '피노누아': ['피노', 'pinot', 'pn'],
    '메를로': ['메를로', 'merlot'],
    '말벡': ['말벡', 'malbec'],
    '시라': ['시라', 'syrah', 'shiraz']
  };

  // 알려진 약어 체크
  for (const [full, abbrs] of Object.entries(knownAbbreviations)) {
    if (v.includes(full.toLowerCase())) {
      if (abbrs.some(abbr => t === abbr.toLowerCase())) {
        return true;
      }
    }
  }

  // 부분 매칭
  if (v.includes(t) && t.length >= 3) return true;

  return false;
}

/* ==================== 토큰 매핑 저장 ==================== */

/**
 * 토큰 매핑 저장/업데이트
 */
export async function upsertTokenMapping(
  token: string,
  mappedText: string,
  tokenType: 'producer' | 'varietal' | 'region' | 'vintage'
): Promise<{ ok: boolean; token: string; mapped: string; count: number }> {
  if (!token || !mappedText) {
    return { ok: false, token: '', mapped: '', count: 0 };
  }

  try {
    // First try to get existing
    const { data: existing } = await supabase
      .from('token_mapping')
      .select('learned_count, confidence')
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      await supabase.from('token_mapping').update({
        mapped_text: mappedText,
        token_type: tokenType,
        learned_count: existing.learned_count + 1,
        confidence: Math.min(1.0, existing.confidence + 0.1),
        last_used_at: new Date().toISOString(),
      }).eq('token', token);

      const count = existing.learned_count + 1;
      console.log(`[AutoLearn] 토큰 매핑: "${token}" → "${mappedText}" (${tokenType}, count: ${count})`);
      return { ok: true, token, mapped: mappedText, count };
    } else {
      await supabase.from('token_mapping').insert({
        token,
        mapped_text: mappedText,
        token_type: tokenType,
        learned_count: 1,
        confidence: 0.5,
      });

      console.log(`[AutoLearn] 토큰 매핑: "${token}" → "${mappedText}" (${tokenType}, count: 1)`);
      return { ok: true, token, mapped: mappedText, count: 1 };
    }
  } catch (err) {
    console.error('[AutoLearn] 토큰 매핑 저장 실패:', err);
    return { ok: false, token: '', mapped: '', count: 0 };
  }
}

/* ==================== ML 데이터 저장 ==================== */

interface MLTrainingInput {
  query: string;
  query_normalized: string;
  selected_item_no: string;
  selected_item_name: string;
  rejected_items: string[];
  client_code: string;
  features: {
    recent_purchase?: number;
    frequency?: number;
    vintage?: number;
    [key: string]: any;
  };
}

/**
 * ML 학습 데이터 저장 (PyTorch 준비)
 */
export async function saveMLTrainingData(input: MLTrainingInput): Promise<{ ok: boolean; id?: number }> {
  try {
    const { data } = await supabase.from('ml_training_data').insert({
      query: input.query,
      query_normalized: input.query_normalized,
      selected_item_no: input.selected_item_no,
      selected_item_name: input.selected_item_name,
      rejected_items: JSON.stringify(input.rejected_items),
      client_code: input.client_code,
      features: JSON.stringify(input.features),
      created_at: new Date().toISOString(),
    }).select('id').single();

    console.log(`[ML Data] 학습 데이터 저장: "${input.query_normalized}" → ${input.selected_item_no}`);

    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[ML Data] 저장 실패:', err);
    return { ok: false };
  }
}

/* ==================== 메인 학습 함수 ==================== */

export interface LearnFromSelectionInput {
  query: string;
  selectedItem: {
    item_no: string;
    item_name: string;
  };
  rejectedItems?: Array<{
    item_no: string;
    item_name: string;
  }>;
  clientCode: string;
  features?: {
    recent_purchase?: number;
    frequency?: number;
    vintage?: number;
    manual_input?: boolean;
    source?: string;
    [key: string]: any;
  };
}

/**
 * 사용자 선택으로부터 자동 학습
 */
export async function learnFromSelection(input: LearnFromSelectionInput): Promise<{
  ok: boolean;
  mappings: Array<{ token: string; mapped: string; type: string; count: number }>;
  mlDataId?: number;
}> {
  const { query, selectedItem, rejectedItems = [], clientCode, features = {} } = input;

  console.log(`\n[AutoLearn] 학습 시작: "${query}" → ${selectedItem.item_no}`);

  // 1. 입력 토큰 추출
  const queryTokens = extractTokens(query);
  console.log(`[AutoLearn] 입력 토큰: ${JSON.stringify(queryTokens)}`);

  // 2. 선택된 품목에서 핵심 키워드 추출
  const keywords = extractKeywords(selectedItem.item_name);
  console.log(`[AutoLearn] 키워드: producer="${keywords.producer}", varietal="${keywords.varietal}", vintage="${keywords.vintage}"`);

  // 3. 토큰 → 키워드 매핑 자동 생성
  const mappings: Array<{ token: string; mapped: string; type: string; count: number }> = [];

  for (const token of queryTokens) {
    // 생산자 약어 감지
    if (keywords.producer && isProducerAbbreviation(token, keywords.producer)) {
      const result = await upsertTokenMapping(token.toLowerCase(), keywords.producer, 'producer');
      if (result.ok) {
        mappings.push({
          token: result.token,
          mapped: result.mapped,
          type: 'producer',
          count: result.count
        });
      }
    }

    // 품종 약어 감지
    if (keywords.varietal && isVarietalAbbreviation(token, keywords.varietal)) {
      const result = await upsertTokenMapping(token.toLowerCase(), keywords.varietal, 'varietal');
      if (result.ok) {
        mappings.push({
          token: result.token,
          mapped: result.mapped,
          type: 'varietal',
          count: result.count
        });
      }
    }
  }

  console.log(`[AutoLearn] 매핑 생성: ${mappings.length}개`);
  mappings.forEach(m => {
    console.log(`  - "${m.token}" → "${m.mapped}" (${m.type}, ${m.count}회)`);
  });

  // 4. ML 학습 데이터 저장
  const mlResult = await saveMLTrainingData({
    query,
    query_normalized: stripQtyAndUnit(query),
    selected_item_no: selectedItem.item_no,
    selected_item_name: selectedItem.item_name,
    rejected_items: rejectedItems.map(r => r.item_no),
    client_code: clientCode,
    features
  });

  return {
    ok: true,
    mappings,
    mlDataId: mlResult.id
  };
}
