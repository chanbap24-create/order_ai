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
    // 노드 key(국가 / 국가>대지역 / 국가>대지역>세부)별 실제 와인 이름 목록
    const winesByKey: Record<string, string[]> = {};
    const pushWine = (key: string, label: string) => {
      const arr = winesByKey[key] || (winesByKey[key] = []);
      if (arr.length < 200) arr.push(label);
    };
    let matched = 0;
    let noRegion = 0; // 산지 문자열 자체가 비어있는 와인
    const unmatchedSamples: string[] = [];

    for (const w of wines) {
      const region = (w.region || '').trim();
      const name = `${w.item_name_kr || ''} ${w.item_name_en || ''}`;
      const m = matchRegionRow(region, name, rows, w.country_en || w.country || '');
      if (!m) {
        if (!region) noRegion++;
        if (unmatchedSamples.length < 500) {
          unmatchedSamples.push(`${w.item_name_kr || w.item_code}${region ? ` · ${region}` : ' · (산지없음)'}`);
        }
        continue;
      }
      matched++;
      const row = m.row;
      const label = w.item_name_kr || w.item_name_en || w.item_code;
      byCountry[row.country] = (byCountry[row.country] || 0) + 1;
      pushWine(row.country, label);
      // 광역 폴백(exact=false)은 대지역/세부산지로 단정하지 않고 국가 카운트만 (오귀속 방지)
      if (m.exact) {
        const mk = `${row.country}>${row.major_region}`;
        byMajor[mk] = (byMajor[mk] || 0) + 1;
        pushWine(mk, label);
        if (row.sub_region) {
          const sk = `${mk}>${row.sub_region}`;
          bySub[sk] = (bySub[sk] || 0) + 1;
          pushWine(sk, label);
        }
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
      winesByKey,
      unmatchedSamples,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
