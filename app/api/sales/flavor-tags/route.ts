// 품번 목록 → 향미 키워드(한글 라벨) 조회. 상세카드 이미지의 향미 칩용.
// tasting_notes.flavor_tags 우선, 없으면 노트 텍스트에서 추출. 빈티지 무시(base 품번) 폴백.
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { flavorLabel, extractFlavorKeys } from '@/app/api/sales/recommend/lib/flavor';

const baseKey = (c: string) => (c && c.length >= 5 ? c.slice(0, 2) + c.slice(4) : c);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const codes: string[] = Array.isArray(body.codes)
      ? body.codes.map(String).filter(Boolean).slice(0, 300) : [];
    if (codes.length === 0) return NextResponse.json({ tags: {} });

    // 노트 전체를 base 품번 맵으로(작은 테이블) — 정확·폴백 모두 커버
    const exact = new Map<string, string[]>();
    const base = new Map<string, string[]>();
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await supabase
        .from('tasting_notes')
        .select('wine_id, nose_note, palate_note, flavor_tags')
        .range(off, off + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const n of data) {
        const keys = (n.flavor_tags && n.flavor_tags.length)
          ? n.flavor_tags
          : [...extractFlavorKeys(`${n.nose_note || ''} ${n.palate_note || ''}`)];
        if (!keys.length) continue;
        exact.set(n.wine_id, keys);
        base.set(baseKey(n.wine_id), keys);
      }
      if (data.length < 1000) break;
    }

    const tags: Record<string, string[]> = {};
    for (const c of codes) {
      const keys = exact.get(c) || base.get(baseKey(c));
      if (keys && keys.length) tags[c] = keys.slice(0, 4).map(flavorLabel);
    }
    return NextResponse.json({ tags });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
