// app/lib/orderInterpreter.ts
import { db } from "./db";
import { config } from "./config";
import { logger } from "./logger";
import { getAllItemsList } from "./parseOrderWithGPT";

// API 키는 런타임에 확인 (빌드 시 env가 없을 수 있음)
function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY environment variable is required');
  return key;
}

/**
 * 발주 해석 결과 타입
 */
export interface OrderInterpretation {
  client_name: string | null;
  items: Array<{
    raw: string;
    qty: number;
    matched_sku: string | null;
    matched_name: string | null;
    confidence: number;
    auto_confirm: boolean;
    reason: string;
  }>;
  needs_review: boolean;
  notes: string[];
}

/**
 * 거래처 히스토리
 */
interface ClientHistory {
  item_no: string;
  item_name: string;
  purchase_count: number;
  last_purchase: string;
}

/**
 * Alias 매핑
 */
interface AliasMap {
  [key: string]: string;
}

/**
 * Alias 매핑 가져오기
 */
function getAliasMap(): AliasMap {
  try {
    const aliases = db
      .prepare(`
        SELECT alias, canonical 
        FROM item_alias 
        ORDER BY count DESC
      `)
      .all() as Array<{ alias: string; canonical: string }>;
    
    const map: AliasMap = {};
    for (const { alias, canonical } of aliases) {
      map[alias.toLowerCase()] = canonical;
    }
    
    return map;
  } catch (error) {
    logger.error('Failed to load alias map', { error });
    return {};
  }
}

/**
 * 거래처 히스토리 가져오기
 */
function getClientHistory(clientCode: string): ClientHistory[] {
  try {
    const history = db
      .prepare(`
        SELECT 
          item_no,
          item_name,
          COUNT(*) as purchase_count,
          MAX(updated_at) as last_purchase
        FROM client_item_stats
        WHERE client_code = ?
        GROUP BY item_no, item_name
        ORDER BY purchase_count DESC, last_purchase DESC
        LIMIT 50
      `)
      .all(clientCode) as ClientHistory[];
    
    return history;
  } catch (error) {
    logger.error('Failed to load client history', { error, clientCode });
    return [];
  }
}

/**
 * 키워드로 관련 품목 필터링 (2단계 필터링 - 1단계)
 */
function filterRelevantItems(message: string, allItems: { item_no: string; name_en: string; name_kr: string }[]): { item_no: string; name_en: string; name_kr: string }[] {
  const messageLower = message.toLowerCase();
  
  // 메시지에서 주요 키워드 추출
  const keywords: string[] = [];
  
  // 브랜드명 패턴
  const brandPatterns = [
    /메종\s*로쉬?\s*벨렌/,
    /찰스\s*하이직/,
    /라피니/,
    /샤토/,
    /도멘/,
  ];
  
  for (const pattern of brandPatterns) {
    const match = messageLower.match(pattern);
    if (match) {
      keywords.push(match[0].replace(/\s+/g, ''));
    }
  }
  
  // 품종명 패턴
  const varietalPatterns = [
    /샤르?도네|chardonnay/i,
    /피노\s*누아|pinot\s*noir/i,
    /까?베르네|cabernet/i,
    /메를?로|merlot/i,
  ];
  
  for (const pattern of varietalPatterns) {
    const match = messageLower.match(pattern);
    if (match) {
      keywords.push(match[0].replace(/\s+/g, ''));
    }
  }
  
  // 키워드가 없으면 전체 반환 (최대 100개)
  if (keywords.length === 0) {
    return allItems.slice(0, 100);
  }
  
  // 키워드와 관련된 품목 필터링
  const relevant = allItems.filter(item => {
    const itemText = (item.name_kr + ' ' + item.name_en).toLowerCase();
    return keywords.some(kw => itemText.includes(kw));
  });
  
  console.log('[필터링]', {
    keywords,
    totalItems: allItems.length,
    filteredItems: relevant.length,
  });
  
  // 필터링 결과가 없으면 전체 반환 (최대 100개)
  if (relevant.length === 0) {
    return allItems.slice(0, 100);
  }
  
  // 최대 50개로 제한
  return relevant.slice(0, 50);
}

/**
 * 발주 해석 엔진 - GPT 호출
 */
export async function interpretOrder(
  rawOrderText: string,
  clientCode?: string
): Promise<OrderInterpretation> {
  try {
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    // 1. 데이터 준비 - parseOrderWithGPT.ts의 getAllItemsList 재사용
    const allItems = getAllItemsList();
    
    if (allItems.length === 0) {
      throw new Error('No company items loaded from Excel');
    }
    
    console.log('[interpretOrder] 품목 로드 성공:', allItems.length, '개');
    
    const relevantItems = filterRelevantItems(rawOrderText, allItems);
    const aliasMap = getAliasMap();
    const clientHistory = clientCode ? getClientHistory(clientCode) : [];
    
    // 2. 시스템 프롬프트 구성
    const systemPrompt = `당신은 한국 와인 수입사의 "발주 해석 엔진"입니다.

**역할:**
카카오톡 자유형식 발주를 분석하여 구조화된 JSON으로 반환합니다.

**절대 규칙:**
1. 추측 금지
   - 확신이 없으면 auto_confirm=false
   - reason에 "확인 필요" 명시
   
2. 범위 제한
   - 회사 취급 리스트 + alias + 거래처 히스토리 내에서만 매칭
   - 외부 지식으로 임의 확장 절대 금지
   
3. 인사말 제거
   - "안녕하세요", "감사합니다" 등 전부 무시
   - 품목 + 수량만 추출
   
4. 출력 강제
   - JSON만 출력
   - 설명, 주석, 자연어 출력 금지

**자동확정 조건 (auto_confirm=true):**
1. 회사 내 단일 취급 품목
2. 거래처가 반복 구매한 품목 (히스토리 확인)
3. 완전히 일치하는 SKU

**자동확정 불가 (auto_confirm=false):**
1. 유사 품목이 2개 이상
2. 거래처 히스토리 없음
3. 부분 일치만 있음
4. 약어만 있고 명확하지 않음

**유사 표기 인식:**
- 샤르도네 = 샤도네 = Chardonnay
- 로쉐 = 로쉬 = Roche
- 피노누아 = 피노 누아 = Pinot Noir
- 까베르네 = 카베르네 = Cabernet
- 띄어쓰기, 특수문자 무시

**confidence 점수:**
- 1.0: 완전 일치 + 단일 품목
- 0.8-0.9: 거래처 히스토리 일치
- 0.6-0.7: 부분 일치
- 0.5 이하: 불확실

**출력 JSON 스키마:**
{
  "client_name": string | null,
  "items": [
    {
      "raw": string,
      "qty": number,
      "matched_sku": string | null,
      "matched_name": string | null,
      "confidence": number,
      "auto_confirm": boolean,
      "reason": string
    }
  ],
  "needs_review": boolean,
  "notes": string[]
}`;

    // 3. 사용자 프롬프트 구성
    const userPrompt = `
**발주 원문:**
"""
${rawOrderText}
"""

${Object.keys(aliasMap).length > 0 ? `
**약어 매핑 (우선 적용):**
${Object.entries(aliasMap).slice(0, 30).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}
` : ''}

${clientHistory.length > 0 ? `
**거래처 구매 이력 (자동확정 우선):**
${clientHistory.slice(0, 20).map(h => 
  `- [${h.item_no}] ${h.item_name} (구매 ${h.purchase_count}회, 최근 ${h.last_purchase})`
).join('\n')}
` : ''}

**회사 취급 와인 리스트 (이 범위 내에서만 매칭):**
총 ${relevantItems.length}개 품목

${relevantItems.map(item => {
  const parts = [];
  if (item.item_no) parts.push(`[${item.item_no}]`);
  if (item.name_kr) parts.push(item.name_kr);
  if (item.name_en && item.name_en !== item.name_kr) parts.push(`(${item.name_en})`);
  return parts.join(' ');
}).join('\n')}

**처리 규칙:**
1. 인사말, 잡담 제거
2. 약어 매핑 적용
3. 거래처 히스토리 우선 매칭
4. 회사 리스트 내에서만 매칭
5. 확신 없으면 auto_confirm=false

**중요:**
- matched_sku는 반드시 위 리스트의 정확한 품목코드만 사용
- 없으면 null
- 임의로 만들지 말 것

반드시 유효한 JSON만 출력하세요.`;

    // 4. GPT 호출
    logger.info('Calling order interpreter', {
      messageLength: rawOrderText.length,
      relevantItemsCount: relevantItems.length,
      aliasCount: Object.keys(aliasMap).length,
      clientHistoryCount: clientHistory.length,
    });

    console.log('\n[발주 해석 엔진 호출]');
    console.log('- 원문 길이:', rawOrderText.length);
    console.log('- 관련 품목:', relevantItems.length, '개');
    console.log('- 약어 매핑:', Object.keys(aliasMap).length, '개');
    console.log('- 거래처 히스토리:', clientHistory.length, '개');

    // Fetch API를 사용한 OpenAI 호출 (SDK 대신)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenAIKey()}`
      },
      body: JSON.stringify({
        model: config.openai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0, // 일관성 극대화
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    
    if (!content) {
      throw new Error('GPT returned empty response');
    }

    const result = JSON.parse(content) as OrderInterpretation;
    
    // 5. 결과 검증
    result.needs_review = result.items.some(item => !item.auto_confirm);
    
    logger.info('Order interpretation completed', {
      itemsCount: result.items.length,
      autoConfirmedCount: result.items.filter(i => i.auto_confirm).length,
      needsReview: result.needs_review,
    });

    return result;
  } catch (error: any) {
    // 상세 에러 정보 로깅
    console.error('===== Order Interpretation Error =====');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    console.error('Error response:', JSON.stringify(error.response?.data || error.response || {}, null, 2));
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('======================================');
    
    logger.error('Order interpretation failed', { 
      error,
      errorMessage: error.message,
      errorStatus: error.status,
      errorCode: error.code,
    });
    
    // Fallback: 간단한 규칙 기반 파싱
    return {
      client_name: null,
      items: [{
        raw: rawOrderText,
        qty: 0,
        matched_sku: null,
        matched_name: null,
        confidence: 0,
        auto_confirm: false,
        reason: `해석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}. Status: ${error.status || 'N/A'}`,
      }],
      needs_review: true,
      notes: [
        'GPT 호출 실패로 자동 해석이 불가능합니다. 수동으로 확인해주세요.',
        `에러 상세: ${error.message || '알 수 없는 오류'}`
      ],
    };
  }
}
