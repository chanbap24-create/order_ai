// app/lib/hybridParser.ts
/**
 * 하이브리드 주문 파싱 시스템
 * 
 * 단계별 전략:
 * 1. [빠름] 룰 기반 파싱 시도
 * 2. [조건부] 실패/불확실하면 GPT 스마트 전처리
 * 3. [빠름] 룰 기반 품목 매칭 (DB 검색)
 * 4. [조건부] 후보가 애매하면 GPT 스마트 선택
 * 
 * 성능:
 * - 90%의 명확한 케이스: 룰만 (초고속)
 * - 10%의 애매한 케이스: GPT 보조 (정확)
 */

import { parseItemsFromMessage } from "./parseItems";
import { smartPreprocessOrder } from "./smartPreprocess";
import { smartMatchItem } from "./smartMatcher";

export async function hybridParseOrder(
  orderText: string,
  options: {
    enableSmartPreprocess?: boolean;
    enableSmartMatching?: boolean;
  } = {}
): Promise<{
  items: Array<{ name: string; qty: number; usedGPT: boolean }>;
  preprocessed: boolean;
}> {
  let text = orderText;
  let preprocessed = false;

  // === Phase 1: 파싱 시도 ===
  let parsed = parseItemsFromMessage(text);
  
  // 파싱 실패 또는 수량 누락이 많으면 전처리
  const failedItems = parsed.filter(p => p.qty === 0 || !p.name);
  const needsPreprocess = failedItems.length > parsed.length * 0.3; // 30% 이상 실패
  
  if (needsPreprocess && options.enableSmartPreprocess) {
    console.log("[Hybrid] Preprocessing with GPT...");
    text = await smartPreprocessOrder(orderText);
    parsed = parseItemsFromMessage(text);
    preprocessed = true;
  }

  // === Phase 2: 품목 매칭 (여기서는 데모용 구조만) ===
  const items = parsed.map(p => ({
    name: p.name,
    qty: p.qty,
    usedGPT: preprocessed
  }));

  return { items, preprocessed };
}

/**
 * 사용 예시:
 * 
 * const result = await hybridParseOrder("샤또마르고 한케이스", {
 *   enableSmartPreprocess: true,
 *   enableSmartMatching: true
 * });
 * 
 * console.log(result.items);
 * // [{ name: "샤또마르고", qty: 12, usedGPT: true }]
 */
