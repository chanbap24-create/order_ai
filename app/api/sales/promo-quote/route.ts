import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { supabase } from '@/app/lib/db';
import { flavorLabel } from '@/app/api/sales/recommend/lib/flavor';

// 프로모션 스타일 견적 카드 보강 — 품번들의 영문명·향미(한글 라벨)를 반환. 세일즈 세션 필요.
// image_url·가격은 추천 결과에 이미 있어 여기선 다루지 않음.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const { codes } = await req.json();
  const list = Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string').slice(0, 60) : [];
  if (list.length === 0) return NextResponse.json({ map: {} });

  const { data: wines } = await supabase
    .from('wines').select('item_code, item_name_en').in('item_code', list);
  const { data: notes } = await supabase
    .from('tasting_notes').select('wine_id, flavor_tags').in('wine_id', list);
  const fmap = new Map((notes || []).map((n) => [n.wine_id, (n.flavor_tags || []) as string[]]));

  const map: Record<string, { name_en: string; flavors: string[] }> = {};
  for (const w of wines || []) {
    map[w.item_code] = {
      name_en: w.item_name_en || '',
      flavors: (fmap.get(w.item_code) || []).slice(0, 5).map((k) => flavorLabel(k)),
    };
  }
  return NextResponse.json({ map });
}
