/**
 * 도메인 공통 상수.
 */

/**
 * 전산 이관(ERP 전환) 시점 = 이월(미수) 기준일.
 * 이 날짜 이후의 출고/수금만 신규 시스템에서 집계하고, 이전은 이월(carryover)에 포함한다.
 * (까브드뱅·대유라이프 공통) — 여러 곳에 흩어져 있던 '2025-08-01' 리터럴의 단일 진실 원천.
 */
export const ERP_CUTOFF_DATE = '2025-08-01';

/** 이월(carryover) 행의 created_at 고정 타임스탬프 (KST 자정). */
export const ERP_CUTOFF_CREATED_AT = `${ERP_CUTOFF_DATE}T00:00:00+09:00`;
