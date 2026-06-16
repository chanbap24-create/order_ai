// 미분류 와인(산지 매칭 실패)을 LLM 지식으로 자동 분류 → wine_regions 에 행 추가.
// region 문자열만 봐도 나라/지역을 아는 LLM 으로, 단순 문자매칭이 못 잡는 산지를 채운다.
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getClaudeClient } from '@/app/lib/claudeClient';
import { getTastingNotes } from '@/app/lib/wineDb';
import { matchRegionRow } from '@/app/api/sales/recommend/lib/regions';
import { handleApiError } from '@/app/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function POST() {
  try {
    const [{ data: regionRows }, wines] = await Promise.all([
      supabase.from('wine_regions').select('id, country, major_region, sub_region, appellation, cru_vineyard'),
      getTastingNotes({ hasNote: true }),
    ]);
    const rows = (regionRows || []) as Row[];

    // 미분류 + region 문자열이 있는 와인의 distinct region
    const distinct = new Map<string, string>(); // region → 대표 와인명
    for (const w of wines) {
      const region = (w.region || '').trim();
      if (!region) continue;
      if (matchRegionRow(region, `${w.item_name_kr || ''} ${w.item_name_en || ''}`, rows)) continue;
      if (!distinct.has(region)) distinct.set(region, w.item_name_kr || w.item_name_en || w.item_code);
    }
    const regionList = Array.from(distinct.keys());
    if (regionList.length === 0) {
      return NextResponse.json({ success: true, classified: 0, addedRows: 0, message: '미분류 산지가 없습니다.' });
    }

    // 기존 국가 라벨(재사용 유도)
    const countries = Array.from(new Set(rows.map((r) => r.country).filter(Boolean)));

    const system = `너는 와인 산지 전문가다. 주어진 "산지 문자열" 각각을 실제 지리 지식으로 분류한다.
출력 형식(JSON 배열만):
[{"region":"입력값","country":"한글 영문","super":"광역(한글 영문, 없으면 \"\")","major":"대지역/지방 (한글 영문)","sub":"세부 산지 (한글 영문)"}]
규칙:
- country 는 가능한 한 아래 기존 라벨을 그대로 재사용: ${countries.join(' / ')}
- 형식은 "한글 영문" (예: "프랑스 France", "미국 USA", "스페인 Spain", "호주 Australia").
- sub 의 영문 부분에는 입력 산지 문자열의 핵심 지명을 그대로 포함시켜라(매칭용). 예: 입력 "Santa Barbara" → sub "산타 바버라 Santa Barbara".
- major 는 그 세부산지가 속한 지방/주(예: 캘리포니아 California, 남호주 South Australia, 카탈루냐 Cataluña, 남부 론 Southern Rhône).
- super 는 부르고뉴/보르도/론/루아르처럼 여러 지방을 묶는 광역만(없으면 빈 문자열).
- 확실히 모르면 그 항목은 빼라(추측 금지).`;

    const user = `다음 산지 문자열들을 분류해줘:\n${regionList.map((r) => `- ${r}  (예: ${distinct.get(r)})`).join('\n')}`;

    const claude = getClaudeClient();
    const resp = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    let parsed: Array<{ region?: string; country?: string; super?: string; major?: string; sub?: string }> = [];
    const m = text.match(/\[[\s\S]*\]/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }

    // 기존 (country, major, sub) 셋
    const existing = new Set(rows.map((r) => `${r.country}|${r.major_region}|${r.sub_region || ''}`));
    const toInsert: Row[] = [];
    const classified: string[] = [];
    for (const p of parsed) {
      const country = (p.country || '').trim();
      const major = (p.major || '').trim();
      const sub = (p.sub || '').trim();
      if (!country || !major || !sub) continue;
      classified.push(`${p.region} → ${country} · ${major} · ${sub}`);
      const key = `${country}|${major}|${sub}`;
      if (existing.has(key)) continue;
      existing.add(key);
      toInsert.push({ country, major_region: major, sub_region: sub, notes: 'AI 자동분류' });
    }

    if (toInsert.length > 0) {
      await supabase.from('wine_regions').insert(toInsert);
    }

    return NextResponse.json({
      success: true,
      unmatchedRegions: regionList.length,
      classified: classified.length,
      addedRows: toInsert.length,
      detail: classified,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
