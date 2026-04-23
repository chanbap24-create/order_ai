/**
 * masterMatcher.ts - English/Riedel 시트 매칭 엔진 배럴.
 * 실제 구현은 master-matcher/ 하위 모듈에 분산.
 */

export type { MasterMatchCandidate, RiedelMatchCandidate } from './master-matcher/types';

export { searchMasterSheet, searchMasterSheetBatch } from './master-matcher/searchMaster';
export { searchRiedelSheet } from './master-matcher/searchRiedel';
