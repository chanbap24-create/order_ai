// 브랜드 자료실 DB CRUD (Supabase)

import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import type { Brand, BrandWithWineCount } from "@/app/types/wine";

/* ─── Brands 목록 조회 ─── */

export async function getBrands(filters?: {
  search?: string;
  country?: string;
}): Promise<BrandWithWineCount[]> {
  let query = supabase.from('brands').select('*');

  if (filters?.search) {
    const s = filters.search.replace(/[%_]/g, '');
    query = query.or(
      `brand_name_kr.ilike.%${s}%,brand_name_en.ilike.%${s}%,brand_code.ilike.%${s}%,country.ilike.%${s}%,region.ilike.%${s}%`
    );
  }
  if (filters?.country) {
    query = query.eq('country', filters.country);
  }

  const { data, error } = await query.order('brand_name_kr', { ascending: true });
  if (error) { logger.warn('getBrands error', { error }); return []; }

  const brands = (data || []) as Brand[];

  // 와인 수 집계
  const wineCounts = await getWineCountsByBrand();

  return brands.map(b => ({
    ...b,
    wine_count: (b.brand_code && wineCounts[b.brand_code]) || 0,
  }));
}

/* ─── 단건 조회 ─── */

export async function getBrandById(id: number): Promise<Brand | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { logger.warn('getBrandById error', { error }); return null; }
  return data as Brand | null;
}

/* ─── 생성 ─── */

export async function createBrand(
  brand: Partial<Brand> & { brand_name_kr: string }
): Promise<Brand | null> {
  const { data, error } = await supabase
    .from('brands')
    .insert(brand)
    .select()
    .single();
  if (error) { logger.warn('createBrand error', { error }); return null; }
  return data as Brand;
}

/* ─── 수정 ─── */

export async function updateBrand(
  id: number,
  updates: Partial<Brand>
): Promise<Brand | null> {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  delete payload.id;
  delete payload.created_at;

  const { data, error } = await supabase
    .from('brands')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) { logger.warn('updateBrand error', { error }); return null; }
  return data as Brand;
}

/* ─── 삭제 ─── */

export async function deleteBrand(id: number): Promise<boolean> {
  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id);
  if (error) { logger.warn('deleteBrand error', { error }); return false; }
  return true;
}

/* ─── brand별 와인 수 집계 ─── */

export async function getWineCountsByBrand(): Promise<Record<string, number>> {
  // SQL GROUP BY로 집계 (전체 행 fetch 대신 집계 결과만)
  const { data, error } = await supabase
    .rpc('get_wine_counts_by_brand');

  if (error || !data) {
    // fallback: rpc 없으면 기존 방식
    const { data: rows, error: e2 } = await supabase
      .from('wines')
      .select('brand')
      .not('brand', 'is', null);
    if (e2 || !rows) return {};
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const b = (row as { brand: string }).brand;
      if (b) counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
  }

  const counts: Record<string, number> = {};
  for (const row of data as { brand: string; cnt: number }[]) {
    if (row.brand) counts[row.brand] = row.cnt;
  }
  return counts;
}

/* ─── 와인 품번으로 브랜드 컨텍스트 가져오기 (AI 조사용) ─── */

export async function getBrandContextForWine(itemCode: string): Promise<string> {
  // 1. wines 테이블에서 brand 코드 조회
  const { data: wine } = await supabase
    .from('wines')
    .select('brand')
    .eq('item_code', itemCode)
    .maybeSingle();

  if (!wine?.brand) return '';

  // 2. brands 테이블에서 브랜드 정보 조회
  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('brand_code', wine.brand)
    .maybeSingle();

  if (!brand || !brand.ai_researched) return '';

  // 3. 컨텍스트 문자열 구성
  const parts: string[] = [];
  if (brand.brand_name_en) parts.push(`Producer: ${brand.brand_name_en}`);
  if (brand.country) parts.push(`Country: ${brand.country}`);
  if (brand.region) parts.push(`Region: ${brand.region}`);
  if (brand.founded_year) parts.push(`Founded: ${brand.founded_year}`);
  if (brand.owner) parts.push(`Owner: ${brand.owner}`);
  if (brand.winemaker) parts.push(`Winemaker: ${brand.winemaker}`);
  if (brand.description) parts.push(`About: ${brand.description}`);
  if (brand.winemaking_philosophy) parts.push(`Winemaking: ${brand.winemaking_philosophy}`);
  if (brand.vineyard_info) parts.push(`Vineyards: ${brand.vineyard_info}`);
  if (brand.certifications) parts.push(`Certifications: ${brand.certifications}`);
  if (brand.key_wines) parts.push(`Key wines: ${brand.key_wines}`);
  if (brand.awards) parts.push(`Awards: ${brand.awards}`);

  if (parts.length === 0) return '';

  logger.info(`[BrandContext] Found brand "${brand.brand_name_en}" for wine ${itemCode}`);
  return parts.join('\n');
}

/* ─── brand_code로 연결된 와인 목록 ─── */

export async function getWinesByBrandCode(brandCode: string) {
  const { data, error } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, item_name_en, wine_type, vintage, supply_price, available_stock, status')
    .eq('brand', brandCode)
    .order('item_name_kr', { ascending: true });
  if (error) { logger.warn('getWinesByBrandCode error', { error }); return []; }
  return data || [];
}
