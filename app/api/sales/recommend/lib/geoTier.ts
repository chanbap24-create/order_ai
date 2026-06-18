// 지역 계단(작은 단위 → 상위). 천장 = 광역(super). 광역 밖은 제외.
import type { RegionHierarchy } from './regions';

export interface RegionProfile {
  subs: Set<string>;    // 거래처가 산 세부산지(마을)
  majors: Set<string>;  // 대지역
  supers: Set<string>;  // 광역(부르고뉴 등)
}

/** 가격 버킷·천장용 광역 그룹 라벨: super 있으면 super, 없으면(신대륙) major. */
export function geoGroup(h: RegionHierarchy | null): string {
  if (!h) return '';
  return h.super_region || h.major_region || '';
}

/**
 * 거래처 지역 프로파일 대비 후보의 근접 계단.
 * 0=같은 마을, 1=같은 대지역, 2=같은 광역. 광역 밖이면 null(추천 제외).
 * (신대륙은 super_region 이 없어 사실상 major=광역 → 같은 major 까지만)
 */
export function geoTier(h: RegionHierarchy | null, p: RegionProfile): number | null {
  if (!h) return null;
  if (h.sub_region && p.subs.has(h.sub_region)) return 0;
  if (h.major_region && p.majors.has(h.major_region)) return 1;
  if (h.super_region && p.supers.has(h.super_region)) return 2;
  return null;
}

export const TIER_LABEL = ['같은 마을', '인근 마을', '같은 광역', '타지역'];
