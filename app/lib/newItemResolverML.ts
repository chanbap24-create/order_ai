/**
 * ML 통합 신규 품목 검색 (PyTorch 기반)
 * 
 * 하이브리드 접근:
 * 1. 기존 Rule-based 매칭 (빠름)
 * 2. 점수 낮으면 ML 매칭 (정확함)
 */

import { db } from '@/app/lib/db';
import { searchMasterSheet, type MasterMatchCandidate } from '@/app/lib/masterMatcher';
import { mlMatch, mlHealthCheck, type MLMatchResult } from '@/app/lib/mlClient';

/**
 * ML 서버 사용 가능 여부 (캐시)
 */
let mlServerAvailable: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1분

/**
 * ML 서버 헬스체크 (캐싱)
 */
async function checkMLServer(): Promise<boolean> {
  const now = Date.now();
  
  // 최근에 체크했으면 캐시 반환
  if (mlServerAvailable !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return mlServerAvailable;
  }
  
  // 헬스체크 수행
  mlServerAvailable = await mlHealthCheck();
  lastHealthCheck = now;
  
  return mlServerAvailable;
}

/**
 * ML 결과를 MasterMatchCandidate 형식으로 변환
 */
function convertMLResult(mlResult: MLMatchResult): MasterMatchCandidate {
  return {
    itemNo: mlResult.item_no,
    koreanName: mlResult.korean_name || '',
    englishName: mlResult.english_name || '',
    vintage: mlResult.vintage || '',
    score: mlResult.score,
    matchedBy: 'pytorch_ml',
    _debug: {
      method: mlResult.method,
      korean_name: mlResult.korean_name || '',
      english_name: mlResult.english_name || '',
    }
  };
}

/**
 * 신규 품목 검색 - ML 통합 버전
 * 
 * @param clientCode - 거래처 코드
 * @param inputName - 사용자 입력 품목명
 * @param currentBestScore - 기존 매칭 시스템의 최고 점수
 * @param threshold - 신규 품목으로 간주할 점수 임계값
 * @param useML - ML 사용 여부 (기본 true)
 * @returns 검색 결과 (신규 품목이 아니면 null)
 */
export async function searchNewItemML(
  clientCode: string,
  inputName: string,
  currentBestScore: number,
  threshold: number = 0.5,
  useML: boolean = true
): Promise<MasterMatchCandidate[] | null> {
  // 1) 기존 매칭 점수가 높으면 신규 품목이 아님
  if (currentBestScore >= threshold) {
    return null;
  }

  // 2) 이미 학습된 신규 품목이 있는지 확인
  const learned = getLearnedNewItem(clientCode, inputName);
  if (learned) {
    return null;
  }

  // 3) Rule-based 검색 먼저 시도 (빠름)
  console.log(`[신규품목] Rule-based 검색: "${inputName}"`);
  const ruleBased = searchMasterSheet(inputName, 5);
  
  // Rule-based 결과가 좋으면 바로 반환
  if (ruleBased.length > 0 && ruleBased[0].score >= 0.7) {
    console.log(`[신규품목] Rule-based 충분: ${ruleBased[0].score.toFixed(3)}`);
    return ruleBased;
  }

  // 4) ML 매칭 시도 (더 정확함)
  if (useML) {
    try {
      const mlAvailable = await checkMLServer();
      
      if (mlAvailable) {
        console.log(`[신규품목] ML 검색 시작: "${inputName}"`);
        
        const mlResponse = await mlMatch({
          query: inputName,
          client_code: clientCode,
          top_k: 5,
          min_score: 0.3
        });
        
        if (mlResponse.success && mlResponse.results.length > 0) {
          console.log(`[신규품목] ML 검색 성공: ${mlResponse.results.length}개 (${mlResponse.processing_time_ms.toFixed(0)}ms)`);
          
          const mlCandidates = mlResponse.results.map(convertMLResult);
          
          // ML 결과가 더 좋으면 ML 반환
          if (mlCandidates[0].score > (ruleBased[0]?.score || 0)) {
            console.log(`[신규품목] ML 우세: ${mlCandidates[0].score.toFixed(3)} vs ${ruleBased[0]?.score.toFixed(3) || 0}`);
            return mlCandidates;
          }
        }
      } else {
        console.log('[신규품목] ML 서버 사용 불가, Rule-based 폴백');
      }
    } catch (error) {
      console.error('[신규품목] ML 검색 오류:', error);
      // ML 실패 시 Rule-based 폴백
    }
  }

  // 5) Rule-based 결과 반환 (폴백)
  return ruleBased.length > 0 ? ruleBased : null;
}

/**
 * 거래처가 이전에 학습한 신규 품목이 있는지 확인
 */
function getLearnedNewItem(
  clientCode: string,
  inputName: string
): { itemNo: string; itemName: string } | null {
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='client_new_items'`
    )
    .get();

  if (!tableExists) {
    return null;
  }

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
 * 배치 검색 (여러 품목 동시 검색)
 */
export async function searchNewItemsBatchML(
  clientCode: string,
  items: Array<{ inputName: string; currentBestScore: number }>,
  threshold: number = 0.5,
  useML: boolean = true
): Promise<Map<string, MasterMatchCandidate[] | null>> {
  const results = new Map<string, MasterMatchCandidate[] | null>();

  // ML 서버 사용 가능하면 배치 처리 (향후 구현)
  // 현재는 순차 처리
  for (const item of items) {
    const candidates = await searchNewItemML(
      clientCode,
      item.inputName,
      item.currentBestScore,
      threshold,
      useML
    );
    results.set(item.inputName, candidates);
  }

  return results;
}
