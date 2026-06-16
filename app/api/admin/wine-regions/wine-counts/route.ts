// 와인산지DB 각 노드(국가/대지역/세부산지)에 매핑된 "우리 와인(테이스팅노트 보유)" 수 집계.
// 추천 엔진과 동일한 matchRegionRow 매칭을 사용 → 추천이 실제로 보는 산지 커버리지를 그대로 반영.
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getTastingNotes } from '@/app/lib/wineDb';
import { matchRegionRow } from '@/app/api/sales/recommend/lib/regions';
import { handleApiError } from '@/app/lib/errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function GET() {
  try {
    const [{ data: regionRows }, wines] = await Promise.all([
      supabase.from('wine_regions').select('id, country, major_region, sub_region, appellation, cru_vineyard, classification'),
      getTastingNotes({ hasNote: true }),
    ]);
    const rows = (regionRows || []) as Row[];

    const byCountry: Record<string, number> = {};
    const byMajor: Record<string, number> = {};
    const bySub: Record<string, number> = {};
    let matched = 0;
    let noRegion = 0; // 산지 문자열 자체가 비어있는 와인
    const unmatchedSamples: string[] = [];

    for (const w of wines) {
      const region = (w.region || '').trim();
      const name = `${w.item_name_kr || ''} ${w.item_name_en || ''}`;
      const m = matchRegionRow(region, name, rows);
      if (!m) {
        if (!region) noRegion++;
        if (unmatchedSamples.length < 20) {
          unmatchedSamples.push(`${w.item_name_kr || w.item_code}${region ? ` (${region})` : ' (산지없음)'}`);
        }
        continue;
      }
      matched++;
      byCountry[m.country] = (byCountry[m.country] || 0) + 1;
      const mk = `${m.country}>${m.major_region}`;
      byMajor[mk] = (byMajor[mk] || 0) + 1;
      if (m.sub_region) {
        const sk = `${mk}>${m.sub_region}`;
        bySub[sk] = (bySub[sk] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      total: wines.length,
      matched,
      unmatched: wines.length - matched,
      noRegion,
      byCountry,
      byMajor,
      bySub,
      unmatchedSamples,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
