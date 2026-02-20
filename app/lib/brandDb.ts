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
  const { data, error } = await supabase
    .from('wines')
    .select('brand')
    .not('brand', 'is', null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    const b = (row as { brand: string }).brand;
    if (b) counts[b] = (counts[b] || 0) + 1;
  }
  return counts;
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
