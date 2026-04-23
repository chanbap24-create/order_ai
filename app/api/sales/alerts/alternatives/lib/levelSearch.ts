import { classRank, extractEnglish } from './regions';
import { grapesOverlap, normalizeGrapes, priceInRange } from './wineAttrs';
import type { RegionHierarchy } from './regions';
import type { Alternative, Candidate } from './types';

type Ctx = {
  itemNo: string;
  targetHierarchy: RegionHierarchy | null;
  targetGrapes: string[];
  targetCountry: string;
  targetPrice: number;
  targetWineName: string;
  targetBaseName: string;
};

/**
 * 6단계 지역 확장 탐색으로 최대 MAX(3)개 대체 와인 선정.
 *
 * Level 0: 같은 와인 다른 빈티지 (품번 패턴 + 이름 기반 fallback)
 * Level 1: 같은 서브리전 + 같은 등급 + 가격 ±40%
 * Level 2: 같은 서브리전 + 가격 ±40% (등급 무관)
 * Level 3: 같은 대지역 + 가격 ±30%
 * Level 4: 같은 슈퍼리전 + 가격 ±40%
 * Level 5: 같은 국가 + 가격 ±50%
 * Level 6: 같은 품종 + 가격 ±50% (글로벌)
 */
export function findAlternatives(candidates: Candidate[], ctx: Ctx, MAX = 3): Alternative[] {
  const { itemNo, targetHierarchy: th, targetGrapes, targetCountry, targetPrice, targetWineName, targetBaseName } = ctx;
  const results: Alternative[] = [];
  const used = new Set<string>();

  function addResult(c: Candidate, level: number, label: string, reasons: string[]) {
    if (used.has(c.item_no)) return;
    used.add(c.item_no);
    results.push({
      item_no: c.item_no,
      item_name: c.item_name,
      country: c.country,
      region: c.region,
      grape: c.grape,
      wine_type: c.wine_type,
      price: c.price,
      stock: c.stock,
      match_level: level,
      match_label: label,
      match_reasons: reasons,
    });
  }

  // Level 0: 같은 와인 다른 빈티지
  {
    const vintageMatch = itemNo.match(/^(\d{2})(\d{2})(\d{3,})$/);
    if (vintageMatch) {
      const [, prefix, , suffix] = vintageMatch;
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        const cMatch = c.item_no.match(/^(\d{2})(\d{2})(\d{3,})$/);
        if (!cMatch) continue;
        if (cMatch[1] === prefix && cMatch[3] === suffix && cMatch[2] !== vintageMatch[2]) {
          addResult(c, 0, '다른 빈티지', [`같은 와인 ${cMatch[2]}빈티지`, `재고 ${c.stock}병`]);
        }
      }
    }
    // 이름 기반 빈티지 매칭 fallback
    if (results.length === 0 && targetBaseName.length > 5) {
      for (const c of candidates) {
        if (used.has(c.item_no) || results.length >= MAX) continue;
        const cBaseName = c.item_name
          .replace(/["'「」]/g, '')
          .replace(/\d{2,4}\s*(빈티지|VT|vintage)?/gi, '')
          .replace(/\s+/g, ' ').trim().toLowerCase();
        if (cBaseName === targetBaseName) {
          addResult(c, 0, '다른 빈티지', ['같은 와인 다른 빈티지', `재고 ${c.stock}병`]);
        }
      }
    }
  }

  // Level 1: 같은 서브리전 + 같은 등급 + 가격 ±40%
  if (th?.sub_region) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (!c.hierarchy || c.hierarchy.sub_region !== th.sub_region) continue;
      if (th.classification && c.hierarchy.classification) {
        if (Math.abs(classRank(c.hierarchy.classification) - classRank(th.classification)) > 2) continue;
      }
      if (!priceInRange(targetPrice, c.price, 0.4)) continue;

      const reasons = [`같은 산지 (${extractEnglish(th.sub_region)})`];
      if (c.hierarchy.classification) reasons.push(c.hierarchy.classification);
      if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
      reasons.push('비슷한 가격');
      addResult(c, 1, `${extractEnglish(th.sub_region)} · 동급`, reasons);
    }
  }

  // Level 2: 같은 서브리전 + 가격 ±40% (등급 무관)
  if (th?.sub_region && results.length < MAX) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (!c.hierarchy || c.hierarchy.sub_region !== th.sub_region) continue;
      if (!priceInRange(targetPrice, c.price, 0.4)) continue;

      const reasons = [`같은 산지 (${extractEnglish(th.sub_region)})`];
      if (c.hierarchy.classification) reasons.push(c.hierarchy.classification);
      if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
      reasons.push('비슷한 가격');
      addResult(c, 2, `${extractEnglish(th.sub_region)}`, reasons);
    }
  }

  // Level 3: 같은 대지역 + 가격 ±30%
  if (th?.major_region && results.length < MAX) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (!c.hierarchy || c.hierarchy.major_region !== th.major_region) continue;
      if (!priceInRange(targetPrice, c.price, 0.3)) continue;

      const reasons = [extractEnglish(th.major_region)];
      if (c.hierarchy.sub_region) reasons.push(extractEnglish(c.hierarchy.sub_region));
      if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
      reasons.push('비슷한 가격');
      addResult(c, 3, extractEnglish(th.major_region), reasons);
    }
  }

  // Level 4: 같은 슈퍼리전 + 가격 ±40%
  if (th?.super_region && results.length < MAX) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (!c.hierarchy || c.hierarchy.super_region !== th.super_region) continue;
      if (!priceInRange(targetPrice, c.price, 0.4)) continue;

      const reasons = [th.super_region];
      if (c.hierarchy.major_region) reasons.push(extractEnglish(c.hierarchy.major_region));
      if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
      reasons.push('비슷한 가격');
      addResult(c, 4, th.super_region, reasons);
    }
  }

  // Level 5: 같은 국가 + 가격 ±50%
  if (targetCountry && results.length < MAX) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (c.country !== targetCountry) continue;
      if (!priceInRange(targetPrice, c.price, 0.5)) continue;

      const reasons = ['같은 국가'];
      if (c.hierarchy?.super_region) reasons.push(c.hierarchy.super_region);
      if (grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) reasons.push('같은 품종');
      reasons.push('유사 가격대');
      addResult(c, 5, '같은 국가', reasons);
    }
  }

  // Level 6: 같은 품종 + 가격 ±50% (글로벌)
  if (results.length < MAX) {
    for (const c of candidates) {
      if (used.has(c.item_no) || results.length >= MAX) continue;
      if (!grapesOverlap(targetGrapes, normalizeGrapes(c.grape))) continue;
      if (!priceInRange(targetPrice, c.price, 0.5)) continue;

      const reasons = ['같은 품종', '유사 가격대'];
      if (c.country) reasons.push(c.country);
      addResult(c, 6, '같은 품종', reasons);
    }
  }

  // 가격 가까운 순으로 2차 정렬
  results.sort((a, b) => {
    if (a.match_level !== b.match_level) return a.match_level - b.match_level;
    return Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice);
  });

  void targetWineName; // 로그 힌트용, 현재 미사용
  return results.slice(0, MAX);
}
