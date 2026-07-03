// 브랜드 약어 → 공급자명 매핑
import { supabase } from '@/app/lib/db';

export const BRAND_TO_SUPPLIER: Record<string, { en: string; kr: string }> = {
  CH: { en: 'Charles Heidsieck', kr: '찰스하이직' },
  GH: { en: "Graham's Port", kr: '그라함' },
  BL: { en: 'Roche de Bellene', kr: '메종 로쉬 벨렌' },
  VG: { en: 'Vincent Girardin', kr: '뱅상 지라르댕' },
  BS: { en: 'Biondi Santi', kr: '비온디 산티' },
  LR: { en: 'Maison Leroy', kr: '메종 르로아' },
  GA: { en: 'Chateau de la Gardine', kr: '샤또 드 라 가르딘' },
  DD: { en: 'Domaine Dufouleur', kr: '도멘 뒤폴레르' },
  AT: { en: 'Altesino', kr: '알테시노' },
  MD: { en: 'Mas des Infirmieres', kr: '마스 데 앙페미에르' },
  VA: { en: 'Veuve Ambal', kr: '뵈브 암발' },
  MG: { en: 'Rodolphe Demougeot', kr: '로돌프 드모조' },
  VP: { en: 'Castello di Volpaia', kr: '볼파이아' },
  RB: { en: 'Roger Belland', kr: '로저 벨랑' },
  AS: { en: 'Anselmi', kr: '안셀미' },
  OR: { en: "Tenuta dell'Ornellaia", kr: '오르넬라이아' },
  CK: { en: 'Chakana', kr: '차카나' },
  SU: { en: 'Soutiran', kr: '수티랑' },
  LM: { en: 'Louis Michel et Fils', kr: '루이 미셸' },
  CA: { en: 'Cascina Adelaide', kr: '카시나 아델라이데' },
  PE: { en: 'Pelassa', kr: '펠라사' },
  LS: { en: 'Luis Seabra', kr: '루이스 세아브라' },
  RF: { en: 'Rathfinny', kr: '라피니' },
  GC: { en: 'Gallica', kr: '갤리카' },
  LC: { en: 'Lake Chalice', kr: '레이크 찰리스' },
  DF: { en: 'Dopff au Moulin', kr: '도프' },
  CD: { en: 'Couly Dutheil', kr: '꿀리 뒤떼이' },
  DP: { en: 'Les Dauphins', kr: '도팡' },
  SM: { en: 'Sumarroca', kr: '수마로카' },
  ST: { en: 'Sentir', kr: '센티르' },
  CO: { en: 'Conceito', kr: '콘세이토' },
  IG: { en: 'I Greppi', kr: '이 그레피' },
  HP: { en: 'Hoopes', kr: '훕스' },
  GE: { en: 'Gamble Family Vineyards', kr: '갬블 에스테이트' },
  FP: { en: 'Fess Parker', kr: '페스 파커' },
  LT: { en: 'Lange Twins', kr: '랭 트윈스' },
  RO: { en: 'Robert Oatley', kr: '로버트 오틀리' },
  WM: { en: 'Chateau Marechaux', kr: '샤또 레 마레쇼' },
  DA: { en: "Domaine d'Auvenay", kr: '도멘 도브네' },
  CL: { en: 'Clement Lavallee', kr: '클레멈 라발리' },
  JP: { en: 'Domaine Jean-Paul Picard', kr: '도멘 장폴 피카르' },
  CF: { en: 'Chateau Favori', kr: '샤또 파보리' },
  BO: { en: 'Borgo Molino', kr: '보르고 몰리노' },
  EF: { en: 'Elena Fucci', kr: '엘레나 푸치' },
  EM: { en: 'Emiliana', kr: '에밀리아나' },
};

/** 브랜드 약어로 공급자명 조회 (하드코딩 맵) */
export function getSupplierByBrand(brand: string | null): { en: string; kr: string } | null {
  if (!brand) return null;
  return BRAND_TO_SUPPLIER[brand.toUpperCase()] || null;
}

export type SupplierName = { en: string; kr: string };

/**
 * 브랜드 약어 → 공급자명 맵 로드 (하드코딩 맵 + 브랜드 자료실 병합).
 * 자료실(brands 테이블)이 우선. 자료실에 브랜드를 등록해두면 동기화·엑셀에서 자동 반영된다.
 */
export async function loadBrandSupplierMap(): Promise<Map<string, SupplierName>> {
  const map = new Map<string, SupplierName>();
  // 1) 하드코딩 폴백
  for (const [code, v] of Object.entries(BRAND_TO_SUPPLIER)) map.set(code.toUpperCase(), v);
  // 2) 브랜드 자료실로 덮어쓰기(최신 소스)
  const { data } = await supabase.from('brands').select('brand_code, brand_name_en, brand_name_kr');
  for (const b of (data || []) as { brand_code: string | null; brand_name_en: string | null; brand_name_kr: string | null }[]) {
    const code = String(b.brand_code || '').trim().toUpperCase();
    if (!code) continue;
    const en = (b.brand_name_en || '').trim();
    const kr = (b.brand_name_kr || '').trim();
    if (en || kr) map.set(code, { en: en || kr, kr: kr || en });
  }
  return map;
}

/** 병합 맵에서 공급자명 조회 (약어 → 공급자명, 자동) */
export function supplierFromMap(brand: string | null, map: Map<string, SupplierName>): SupplierName | null {
  if (!brand) return null;
  return map.get(brand.toUpperCase()) || null;
}
