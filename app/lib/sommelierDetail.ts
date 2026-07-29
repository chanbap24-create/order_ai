// 소믈리에 상세 — 결과 카드 전체화면에 얹는 테이스팅 노트 정보 로드
import { supabase } from './db';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';

export type SommelierDetail = {
  color_note: string | null;
  nose_note: string | null;
  palate_note: string | null;
  food_pairing: string | null;
  serving_temp: string | null;
  grape_varieties: string | null;
  alcohol: string | null;
  country: string | null;
  region: string | null;
  flavors: string[]; // 한글 라벨
};

export async function loadSommelierDetail(code: string): Promise<SommelierDetail> {
  const [{ data: w }, { data: n }] = await Promise.all([
    supabase.from('wines')
      .select('grape_varieties, alcohol, country, region')
      .eq('item_code', code).maybeSingle(),
    supabase.from('tasting_notes')
      .select('color_note, nose_note, palate_note, food_pairing, serving_temp, flavor_tags')
      .eq('wine_id', code).maybeSingle(),
  ]);
  const tags: string[] = Array.isArray(n?.flavor_tags) ? n.flavor_tags : [];
  return {
    color_note: n?.color_note || null,
    nose_note: n?.nose_note || null,
    palate_note: n?.palate_note || null,
    food_pairing: n?.food_pairing || null,
    serving_temp: n?.serving_temp || null,
    grape_varieties: w?.grape_varieties || null,
    alcohol: w?.alcohol || null,
    country: w?.country || null,
    region: w?.region || null,
    flavors: tags.map((t) => FLAVOR_KO[t] || t),
  };
}
