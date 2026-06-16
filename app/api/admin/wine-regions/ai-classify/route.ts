// 미분류 와인(산지 매칭 실패) 전체를 LLM 으로 일괄 자동 분류 → wine_regions 보강.
// 실제 분류 로직은 lib/classify.ts(ensureRegionsClassified)에 있고, 여기선 대상 와인만 모아 호출.
import { NextResponse } from 'next/server';
import { getTastingNotes } from '@/app/lib/wineDb';
import { ensureRegionsClassified } from '../lib/classify';
import { handleApiError } from '@/app/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const wines = await getTastingNotes({ hasNote: true });
    const r = await ensureRegionsClassified(
      wines.map((w) => ({
        region: w.region,
        name: `${w.item_name_kr || ''} ${w.item_name_en || ''}`,
        country: w.country_en || w.country || '',
      })),
    );
    return NextResponse.json({ success: true, ...r });
  } catch (e) {
    return handleApiError(e);
  }
}
