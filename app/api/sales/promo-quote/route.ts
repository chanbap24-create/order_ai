import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';

// 프로모션 스타일 견적 카드 보강 — 품번별 영문명·향미(기본 스타일) + 양조·빈티지·와이너리·로고(스토리 스타일).
// 세일즈 세션 필요. image_url·가격은 추천 결과에 이미 있어 여기선 다루지 않음.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const { codes } = await req.json();
  const list = Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string').slice(0, 60) : [];
  if (list.length === 0) return NextResponse.json({ map: {} });

  const [{ data: wines }, { data: notes }] = await Promise.all([
    supabase.from('wines').select('item_code, item_name_en, brand').in('item_code', list),
    supabase.from('tasting_notes')
      .select('wine_id, flavor_tags, winemaking, vintage_note, winery_description').in('wine_id', list),
  ]);
  const nmap = new Map((notes || []).map((n) => [n.wine_id, n]));

  // 브랜드(와이너리) 로고·이름·소개 — wines.brand(=brand_code) 기준. 브랜드자료실의 description을
  // 와이너리 설명 폴백으로 사용(노트에 없어도 브랜드 소개로 채움).
  const brandCodes = [...new Set((wines || []).map((w) => (w.brand || '').toUpperCase()).filter(Boolean))];
  const bmap = new Map<string, { name: string; hasLogo: boolean; description: string }>();
  if (brandCodes.length) {
    const { data: brands } = await supabase
      .from('brands').select('brand_code, brand_name_en, brand_name_kr, logo_url, description').in('brand_code', brandCodes);
    for (const b of brands || []) {
      bmap.set((b.brand_code || '').toUpperCase(), {
        name: b.brand_name_en || b.brand_name_kr || '',
        hasLogo: /^(https?:\/\/|data:image\/)/.test(b.logo_url || ''),
        description: b.description || '',
      });
    }
  }

  const map: Record<string, {
    name_en: string; flavors: string[];
    winemaking: string; vintage: string; winery: string;
    brand_code: string; winery_name: string; has_logo: boolean;
  }> = {};
  for (const w of wines || []) {
    const n = nmap.get(w.item_code);
    const bc = (w.brand || '').toUpperCase();
    const b = bmap.get(bc);
    map[w.item_code] = {
      name_en: w.item_name_en || '',
      flavors: ((n?.flavor_tags || []) as string[]).slice(0, 5).map((k) => flavorLabel(k)),
      winemaking: n?.winemaking || '',
      vintage: n?.vintage_note || '',
      winery: n?.winery_description || '',
      brand_code: bc,
      winery_name: b?.name || '',
      has_logo: !!b?.hasLogo,
    };
  }

  // 와이너리 설명 폴백(생산자 단위 정보): ① 노트의 winery_description →
  //   ② 같은 브랜드의 채워진 와인에서 승계 → ③ 브랜드자료실(brands.description).
  const wineryByBrand = new Map<string, string>();
  for (const v of Object.values(map)) {
    if (v.brand_code && v.winery && !wineryByBrand.has(v.brand_code)) wineryByBrand.set(v.brand_code, v.winery);
  }
  for (const v of Object.values(map)) {
    if (v.winery) continue;
    if (v.brand_code && wineryByBrand.has(v.brand_code)) v.winery = wineryByBrand.get(v.brand_code)!;
    else if (v.brand_code) v.winery = bmap.get(v.brand_code)?.description || '';
  }

  return NextResponse.json({ map });
}
