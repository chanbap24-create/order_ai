// app/lib/parseOrderWithGPT.ts
import OpenAI from "openai";
import { db } from "./db";
import { config } from "./config";
import { logger } from "./logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * GPT를 활용하여 자연어 발주 메시지를 구조화
 * 1. 우리 회사 전체 품목 리스트 제공
 * 2. 해당 거래처의 입고 이력 제공
 * 3. GPT가 자연어를 분석하여 품목 매칭
 */

interface ParsedOrder {
  client: string;
  items: Array<{
    name: string;
    qty: number;
    matched_item_no?: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

/**
 * 전체 품목 리스트 가져오기 (English 시트 기반)
 * B열: 품목코드, H열: 영문명, I열: 한글명
 * Export for use in other modules
 */
export function getAllItemsList(): Array<{ item_no: string; name_en: string; name_kr: string }> {
  try {
    const XLSX = require('xlsx');
    const path = require('path');
    
    // Excel 파일 읽기
    const xlsxPath = process.env.ORDER_AI_XLSX_PATH || path.join(process.cwd(), 'order-ai.xlsx');
    const workbook = XLSX.readFile(xlsxPath);
    const worksheet = workbook.Sheets['English'];
    
    if (!worksheet) {
      logger.error('English sheet not found in Excel file');
      return [];
    }
    
    // 시트를 배열로 변환
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    const items: Array<{ item_no: string; name_en: string; name_kr: string }> = [];
    
    // 4행부터 시작 (0-indexed로 3부터)
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const itemNo = String(row[1] || '').trim(); // B열 (index 1)
      const nameEn = String(row[7] || '').trim(); // H열 (index 7)
      const nameKr = String(row[8] || '').trim(); // I열 (index 8)
      
      // 품목코드가 있는 경우만 추가
      if (itemNo && (nameEn || nameKr)) {
        items.push({
          item_no: itemNo,
          name_en: nameEn,
          name_kr: nameKr,
        });
      }
    }
    
    logger.info('Loaded items from Excel', { count: items.length });
    return items;
  } catch (error) {
    logger.error('Failed to get all items list from Excel', { error });
    
    // Fallback: DB에서 가져오기
    try {
      const itemsEn = db
        .prepare(`SELECT item_no, name_en FROM item_english WHERE name_en IS NOT NULL AND name_en != ''`)
        .all() as Array<{ item_no: string; name_en: string }>;

      const itemsKr = db
        .prepare(`
          SELECT DISTINCT item_no, item_name 
          FROM client_item_stats 
          WHERE item_name IS NOT NULL AND item_name != ''
        `)
        .all() as Array<{ item_no: string; item_name: string }>;

      const itemMap = new Map<string, { item_no: string; name_en: string; name_kr: string }>();

      for (const item of itemsEn) {
        itemMap.set(item.item_no, {
          item_no: item.item_no,
          name_en: item.name_en,
          name_kr: '',
        });
      }

      for (const item of itemsKr) {
        const existing = itemMap.get(item.item_no);
        if (existing) {
          existing.name_kr = item.item_name;
        } else {
          itemMap.set(item.item_no, {
            item_no: item.item_no,
            name_en: '',
            name_kr: item.item_name,
          });
        }
      }

      return Array.from(itemMap.values());
    } catch (dbError) {
      logger.error('Fallback DB query also failed', { dbError });
      return [];
    }
  }
}

/**
 * 특정 거래처의 입고 이력 가져오기
 */
function getClientItemHistory(clientCode: string): Array<{ item_no: string; item_name: string; supply_price?: number }> {
  try {
    const items = db
      .prepare(`
        SELECT item_no, item_name, supply_price 
        FROM client_item_stats 
        WHERE client_code = ?
        ORDER BY updated_at DESC
        LIMIT 200
      `)
      .all(clientCode) as Array<{ item_no: string; item_name: string; supply_price: number | null }>;

    return items.map(item => ({
      item_no: item.item_no,
      item_name: item.item_name,
      supply_price: item.supply_price || undefined,
    }));
  } catch (error) {
    logger.error('Failed to get client item history', { error, clientCode });
    return [];
  }
}

/**
 * 학습된 약어 매핑 가져오기
 */
function getLearnedAliases(): Array<{ alias: string; canonical: string; count: number }> {
  try {
    const aliases = db
      .prepare(`
        SELECT alias, canonical, count 
        FROM item_alias 
        ORDER BY count DESC
      `)
      .all() as Array<{ alias: string; canonical: string; count: number }>;

    return aliases;
  } catch (error) {
    logger.error('Failed to get learned aliases', { error });
    return [];
  }
}

/**
 * 품목명에서 주요 키워드 추출 (브랜드명, 품종 등)
 */
function extractKeywords(itemName: string): string[] {
  const keywords: string[] = [];
  
  // 브랜드명 패턴
  const brandPatterns = [
    /메종\s*로쉬?\s*벨렌/,
    /찰스\s*하이직/,
    /라피니/,
    /샤또/,
    /도멘/,
    /메종/,
  ];
  
  for (const pattern of brandPatterns) {
    const match = itemName.match(pattern);
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
    /시라|쉬라|씨라|syrah|shiraz/i,
    /말벡|malbec/i,
  ];
  
  for (const pattern of varietalPatterns) {
    const match = itemName.match(pattern);
    if (match) {
      keywords.push(match[0].replace(/\s+/g, ''));
    }
  }
  
  return keywords;
}

/**
 * 메시지에서 관련 품목만 필터링 (2단계 매칭 - 1차 필터링)
 */
function filterRelevantItems(
  message: string,
  allItems: Array<{ item_no: string; name_en: string; name_kr: string }>
): Array<{ item_no: string; name_en: string; name_kr: string }> {
  // 메시지에서 키워드 추출
  const messageKeywords = extractKeywords(message.toLowerCase());
  
  if (messageKeywords.length === 0) {
    // 키워드가 없으면 전체 반환 (최대 100개)
    return allItems.slice(0, 100);
  }
  
  // 키워드와 관련된 품목만 필터링
  const relevantItems = allItems.filter(item => {
    const itemText = (item.name_kr + ' ' + item.name_en).toLowerCase();
    const itemKeywords = extractKeywords(itemText);
    
    // 메시지 키워드 중 하나라도 품목에 포함되면 관련 품목으로 간주
    return messageKeywords.some(msgKw => 
      itemKeywords.some(itemKw => 
        itemKw.includes(msgKw) || msgKw.includes(itemKw) || itemText.includes(msgKw)
      )
    );
  });
  
  console.log('[필터링 결과]', {
    messageKeywords,
    totalItems: allItems.length,
    filteredItems: relevantItems.length,
  });
  
  // 필터링 결과가 너무 적으면 전체 반환 (최대 100개)
  if (relevantItems.length === 0) {
    return allItems.slice(0, 100);
  }
  
  // 최대 50개로 제한
  return relevantItems.slice(0, 50);
}

/**
 * GPT를 사용하여 발주 메시지 파싱
 */
export async function parseOrderWithGPT(
  message: string,
  clientCode?: string,
  options?: { type?: 'wine' | 'glass' }
): Promise<ParsedOrder> {
  const pageType = options?.type || 'wine';

  // 1. 전체 품목 리스트 가져오기
  const allItems = getAllItemsList();
  
  // 1.5. 관련 품목만 필터링 (2단계 매칭 - 1차 필터링)
  const relevantItems = filterRelevantItems(message, allItems);
  
  // 2. 거래처 입고 이력 가져오기 (clientCode가 있는 경우)
  const clientHistory = clientCode ? getClientItemHistory(clientCode) : [];

  // 3. 학습된 약어 가져오기
  const learnedAliases = getLearnedAliases();

  // 4. GPT 프롬프트 구성
  const systemPrompt = `당신은 와인/와인잔 발주 메시지를 파싱하는 전문가입니다.

**당신의 임무:**
우리 회사의 전체 품목 데이터베이스를 기억하고, 자연어 발주 메시지를 정확한 품목코드로 매칭하세요.

**품목 데이터베이스 구조:**
- 품목코드 (item_no): 고유 식별자 (예: 1H19001, 00NV801)
- 영문명 (name_en): 영어 품목명
- 한글명 (name_kr): 한국어 품목명

**매칭 우선순위:**
1. **약어 변환**: 학습된 약어를 먼저 적용 (ch→찰스 하이직, rf→라피니)
2. **거래처 입고 이력**: 해당 거래처가 과거에 주문한 품목 우선 (High confidence)
3. **전체 품목 DB**: 입고 이력 없어도 전체 DB에 있으면 매칭 (Medium confidence)
4. **유사도 매칭**: 오타/약어/부분 일치 허용
5. **매칭 실패**: 명확하지 않으면 Low confidence

**중요: 유사 표기 인식 규칙 (필수 적용!)**
다음 표기들은 동일한 품목으로 인식하세요:
- **샤르도네** = **샤도네** = Chardonnay (모두 같은 품종)
- **로쉐** = **로쉬** = Roche (발음 차이만 있음)
- **피노누아** = **피노 누아** = Pinot Noir (띄어쓰기 차이)
- **까베르네** = **카베르네** = Cabernet (ㄲ/ㅋ 차이)
- **메를로** = **메를로** = Merlot
- **시라** = **쉬라** = **씨라** = Syrah/Shiraz
- **말벡** = **말백** = Malbec
- 띄어쓰기, 쉼표, 특수문자는 무시하고 매칭

**품목 매칭 규칙:**
- 영문명과 한글명 모두 비교
- 브랜드명, 품종명, 빈티지 등 **부분 매칭 적극 허용**
- 예시:
  * "찰스" → "찰스 하이직"
  * "라피니 블랑" → "라피니 블랑 드 블랑"
  * "메종 로쉐 벨렌 샤르도네" → "메종 로쉬 벨렌, 부르고뉴 샤도네"
  * "샤또 마고" → "샤또 마고"
- 품목코드 앞부분도 힌트 (CH=찰스 하이직, RF=라피니 등)
- **부분 일치 시**: 브랜드명(메종 로쉬 벨렌) + 품종(샤도네)이 모두 포함되면 매칭 성공

**매칭 예시 (Few-shot Learning):**
1. 입력: "메종 로쉐 벨렌 샤르도네" 
   → 매칭: [3020041] 메종 로쉬 벨렌, 부르고뉴 샤도네 "뀌베 리져브"
   → 이유: "로쉐"="로쉬", "샤르도네"="샤도네", 브랜드명 일치

2. 입력: "ch 2"
   → 약어 변환: "찰스 하이직 2"
   → 매칭: [00NV801] 찰스 하이직, 브륏 리저브

3. 입력: "라피니 블랑"
   → 매칭: [1H19002] 라피니 블랑 드 블랑
   → 이유: 부분 일치 ("라피니 블랑"이 포함됨)

**출력 필수사항:**
- matched_item_no: 반드시 정확한 품목코드 (예: 00NV801)
- confidence: high/medium/low 명확히 구분
- 매칭 불가 시 null, 절대 임의로 만들지 말 것`;

  const userPrompt = `
**발주 메시지:**
"""
${message}
"""

${learnedAliases.length > 0 ? `
**학습된 약어 매핑 (우선 적용!):**
${learnedAliases.map(a => `- "${a.alias}" → "${a.canonical}" (사용횟수: ${a.count})`).join('\n')}
` : ''}

${clientHistory.length > 0 ? `
**이 거래처의 입고 이력 (최근 200개, 우선 매칭!):**
${clientHistory.slice(0, 50).map(item => `- ${item.item_no}: ${item.item_name}`).join('\n')}
${clientHistory.length > 50 ? `... 외 ${clientHistory.length - 50}개` : ''}
` : ''}

**우리 회사 품목 데이터베이스 (발주 메시지와 관련된 품목만):**
총 ${relevantItems.length}개 품목 (전체 ${allItems.length}개 중 필터링)

${relevantItems.map(item => {
  const parts = [];
  if (item.item_no) parts.push(`[${item.item_no}]`);
  if (item.name_kr) parts.push(item.name_kr);
  if (item.name_en && item.name_en !== item.name_kr) parts.push(`(${item.name_en})`);
  return parts.join(' ');
}).join('\n')}

**매칭 시 위 품목코드([...])를 정확히 사용하세요!**

**출력 형식 (JSON):**
{
  "client": "거래처명 (첫 줄 또는 명시된 거래처, 없으면 빈 문자열)",
  "items": [
    {
      "name": "파싱된 품목명 (약어 적용 후)",
      "qty": 수량(숫자),
      "matched_item_no": "매칭된 품번 (item_no, 매칭 안 되면 null)",
      "confidence": "high | medium | low"
    }
  ]
}

**매칭 프로세스:**
1. 약어 매핑 적용 (예: "ch 2" → "찰스 하이직 2")
2. 거래처 입고 이력에서 검색 → 있으면 "high" confidence
3. 전체 품목 리스트에서 검색 → 있으면 "medium" confidence
4. 매칭 실패 → "low" confidence

반드시 유효한 JSON만 출력하세요.`;

  try {
    logger.info('Calling GPT for order parsing', {
      messageLength: message.length,
      clientCode,
      clientHistoryCount: clientHistory.length,
      allItemsCount: allItems.length,
      relevantItemsCount: relevantItems.length,
      learnedAliasesCount: learnedAliases.length,
    });

    console.log('\n[GPT 파싱 준비 - 2단계 매칭]');
    console.log('- 메시지 길이:', message.length);
    console.log('- 학습된 약어:', learnedAliases.length, '개');
    console.log('- 거래처 입고 이력:', clientHistory.length, '개');
    console.log('- 전체 품목:', allItems.length, '개');
    console.log('- 필터링된 품목:', relevantItems.length, '개 ⭐');
    if (learnedAliases.length > 0) {
      console.log('- 주요 약어:', learnedAliases.slice(0, 10).map(a => `${a.alias}→${a.canonical}`).join(', '));
    }

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0, // 일관성과 정확성을 위해 최저 temperature
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('GPT returned empty response');
    }

    const parsed = JSON.parse(content) as ParsedOrder;

    logger.info('GPT parsing completed', {
      clientDetected: parsed.client,
      itemsCount: parsed.items.length,
      itemsWithHighConfidence: parsed.items.filter(i => i.confidence === 'high').length,
    });

    return parsed;
  } catch (error) {
    logger.error('GPT parsing failed', { error, message });
    
    // Fallback: 간단한 규칙 기반 파싱
    return fallbackParse(message);
  }
}

/**
 * GPT 실패 시 Fallback 파서
 */
function fallbackParse(message: string): ParsedOrder {
  const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
  const client = lines[0] || '';
  const items: ParsedOrder['items'] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(.+?)\s+(\d+)\s*(병|개|박스|cs|box|btl)?/i);
    if (match) {
      items.push({
        name: match[1].trim(),
        qty: parseInt(match[2]),
        confidence: 'low',
      });
    }
  }

  return { client, items };
}
