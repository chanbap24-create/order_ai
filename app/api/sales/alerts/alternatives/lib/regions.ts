const SUPER_REGION_MAP: Record<string, string> = {
  '메독 Médoc': 'Bordeaux', '그라브 Graves': 'Bordeaux', '우안 Right Bank': 'Bordeaux',
  '소테른 Sauternes': 'Bordeaux', '기타 보르도': 'Bordeaux',
  '샤블리 Chablis': 'Burgundy', '코트 드 뉘 Côte de Nuits': 'Burgundy',
  '코트 드 본 Côte de Beaune': 'Burgundy', '코트 샬로네즈 Côte Chalonnaise': 'Burgundy',
  '마코네 Mâconnais': 'Burgundy', '광역 Régionale': 'Burgundy',
  '북부 론 Northern Rhône': 'Rhône', '남부 론 Southern Rhône': 'Rhône',
  '상부 루아르 Upper Loire': 'Loire', '투렌 Touraine': 'Loire',
  '앙주소뮈르 Anjou-Saumur': 'Loire', '낭트 Nantais': 'Loire',
  '알자스 Alsace': 'Alsace', '샴페인 Champagne': 'Champagne',
  '랑그독 Languedoc': 'Languedoc-Roussillon', '루시용 Roussillon': 'Languedoc-Roussillon',
  '프로방스 Provence': 'Provence', '쥐라 Jura': 'Jura-Savoie', '사부아 Savoie': 'Jura-Savoie',
  '남서부 Sud-Ouest': 'Sud-Ouest', '코르시카 Corsica': 'Corsica',
};

/**
 * 등급 순위 (낮을수록 높음).
 */
export function classRank(cls: string | null): number {
  if (!cls) return 99;
  const c = cls.toLowerCase();
  if (c.includes('grand cru') && !c.includes('classé')) return 1;
  if (c.includes('1er') || c.includes('premier cru')) return 2;
  if (c.includes('2ème')) return 3;
  if (c.includes('3ème')) return 4;
  if (c.includes('4ème')) return 5;
  if (c.includes('5ème')) return 6;
  if (c.includes('classé')) return 7;
  if (c.includes('bourgeois')) return 8;
  if (c.includes('village')) return 10;
  if (c.includes('régionale') || c.includes('regionale')) return 15;
  return 12;
}

export function extractClassification(name: string, region: string): string {
  const text = `${name} ${region}`.toLowerCase();
  const hasGrandCru = /grand\s*cru/.test(text) || text.includes('그랑 크뤼');
  if (hasGrandCru && !/classé|classe/.test(text)) return 'Grand Cru';
  if (/1er\s*cru|premier\s*cru/.test(text) || text.includes('프리미에 크뤼')) return 'Premier Cru';
  return '';
}

export interface RegionHierarchy {
  sub_region: string;
  major_region: string;
  super_region: string;
  classification: string;
}

export interface WineRegionRow {
  sub_region: string | null;
  major_region: string;
  appellation: string | null;
  cru_vineyard: string | null;
  classification: string | null;
}

export function extractEnglish(bilingual: string): string {
  const parts = bilingual.split(/\s+/);
  const enIdx = parts.findIndex((p) => /^[A-ZÀ-ÿ]/.test(p));
  if (enIdx >= 0) return parts.slice(enIdx).join(' ');
  return bilingual;
}

/**
 * wine region + name으로 wine_regions 계층 위치 찾기.
 * cru > appellation > sub_region 순 점수.
 */
export function findHierarchy(
  wineRegion: string,
  wineName: string,
  regionRows: WineRegionRow[],
): RegionHierarchy | null {
  if (!wineRegion && !wineName) return null;
  const regionLower = (wineRegion || '').toLowerCase();
  const nameLower = (wineName || '').toLowerCase();
  const parts = regionLower.split(',').map((p) => p.trim()).filter(Boolean);
  const specific = parts[0] || '';

  let bestMatch: WineRegionRow | null = null;
  let bestScore = 0;

  for (const row of regionRows) {
    const subEn = extractEnglish(row.sub_region || '').toLowerCase();
    const appEn = extractEnglish(row.appellation || '').toLowerCase();
    const cruEn = (row.cru_vineyard || '').toLowerCase();
    let score = 0;

    if (cruEn && (nameLower.includes(cruEn) || regionLower.includes(cruEn))) score = 100;
    else if (appEn && specific.includes(appEn.replace(' aoc', '').replace(' 1er cru', ''))) score = 80;
    else if (subEn && (specific.includes(subEn) || subEn.includes(specific))) score = 60;
    else if (subEn && regionLower.includes(subEn)) score = 40;
    else if (subEn && nameLower.includes(subEn)) score = 30;

    if (score > bestScore) { bestScore = score; bestMatch = row; }
  }

  if (!bestMatch || bestScore < 30) return null;

  const subRegion = bestMatch.sub_region || bestMatch.major_region;
  const majorRegion = bestMatch.major_region;
  const superRegion = SUPER_REGION_MAP[majorRegion] || '';

  let classification = bestMatch.classification || '';
  const extracted = extractClassification(wineName, wineRegion);
  if (extracted && (!classification || classRank(extracted) < classRank(classification))) {
    classification = extracted;
  }

  return { sub_region: subRegion, major_region: majorRegion, super_region: superRegion, classification };
}
