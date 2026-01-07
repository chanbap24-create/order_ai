/**
 * newItemResolver.ts
 * 
 * 신규 품목 검색 헬퍼 (기존 DB에 없는 품목을 English 시트에서 검색)
 */

import { db } from '@/app/lib/db';
import { searchMasterSheet, type MasterMatchCandidate } from '@/app/lib/masterMatcher';

/**
 * 거래처가 이전에 학습한 신규 품목이 있는지 확인
 */
export function getLearnedNewItem(
  clientCode: string,
  inputName: string
): { itemNo: string; itemName: string } | null {
  // client_new_items 테이블이 있는지 확인
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='client_new_items'`
    )
    .get();

  if (!tableExists) {
    return null;
  }

  // 학습된 신규 품목 조회
  const row = db.prepare(`
    SELECT item_no, item_name 
    FROM client_new_items 
    WHERE client_code = ? AND input_name = ?
    ORDER BY learned_at DESC
    LIMIT 1
  `).get(clientCode, inputName) as any;

  if (!row) {
    return null;
  }

  return {
    itemNo: row.item_no,
    itemName: row.item_name,
  };
}

/**
 * 신규 품목인지 확인하고 English 시트에서 검색
 * 
 * @param clientCode - 거래처 코드
 * @param inputName - 사용자 입력 품목명
 * @param currentBestScore - 기존 매칭 시스템의 최고 점수
 * @param threshold - 신규 품목으로 간주할 점수 임계값 (기본 0.5)
 * @returns English 시트 검색 결과 (신규 품목이 아니면 null)
 */
export function searchNewItem(
  clientCode: string,
  inputName: string,
  currentBestScore: number,
  threshold: number = 0.5
): MasterMatchCandidate[] | null {
  // 1) 기존 매칭 점수가 높으면 신규 품목이 아님
  if (currentBestScore >= threshold) {
    return null;
  }

  // 2) 이미 학습된 신규 품목이 있는지 확인
  const learned = getLearnedNewItem(clientCode, inputName);
  if (learned) {
    // 학습된 품목이 있으면 이미 처리된 것으로 간주
    return null;
  }

  // 3) English 시트에서 검색
  const candidates = searchMasterSheet(inputName, 5);

  // 최소 1개 이상의 후보가 있어야 함
  if (candidates.length === 0) {
    return null;
  }

  return candidates;
}

/**
 * 일괄 신규 품목 검색
 */
export function searchNewItemsBatch(
  clientCode: string,
  items: Array<{ inputName: string; currentBestScore: number }>,
  threshold: number = 0.5
): Record<string, MasterMatchCandidate[]> {
  const results: Record<string, MasterMatchCandidate[]> = {};

  for (const { inputName, currentBestScore } of items) {
    const candidates = searchNewItem(clientCode, inputName, currentBestScore, threshold);
    if (candidates) {
      results[inputName] = candidates;
    }
  }

  return results;
}
