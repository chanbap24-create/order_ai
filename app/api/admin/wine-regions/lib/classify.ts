// 산지 문자열을 LLM 지식으로 분류 → wine_regions 자동 보강.
// 단순 문자매칭이 못 잡는 산지를, region 만 봐도 나라/지역을 아는 LLM 으로 채운다.
// 동기화/AI조사 등 "테이스팅 노트 자료 입력" 시점과 배치 버튼에서 공용으로 사용.
import { supabase } from '@/app/lib/db';
import { getClaudeClient } from '@/app/lib/claudeClient';
import { matchRegionRow } from '@/app/api/sales/recommend/lib/regions';

const MODEL = 'claude-sonnet-4-6';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface ClassifiedRegion {
  region?: string; country?: string; super?: string; major?: string; sub?: string;
}

export interface WineLite { region?: string | null; name?: string; country?: string | null }

export interface ClassifySummary {
  unmatchedRegions: number; classified: number; addedRows: number; detail: string[];
}

/** 산지 문자열 목록을 LLM 으로 나라/광역/대지역/세부산지 분류(순수 LLM, DB 미접근). */
export async function classifyRegionStrings(
  regionList: string[],
  countries: string[],
  examples?: Map<string, string>,
): Promise<ClassifiedRegion[]> {
  if (regionList.length === 0) return [];
  const system = `너는 와인 산지 전문가다. 주어진 "산지 문자열" 각각을 실제 지리 지식으로 분류한다.
출력 형식(JSON 배열만):
[{"region":"입력값","country":"한글 영문","super":"광역(한글 영문, 없으면 \"\")","major":"대지역/지방 (한글 영문)","sub":"세부 산지 (한글 영문)"}]
규칙:
- country 는 가능한 한 아래 기존 라벨을 그대로 재사용: ${countries.join(' / ')}
- 형식은 "한글 영문" (예: "프랑스 France", "미국 USA", "스페인 Spain", "호주 Australia", "영국 England").
- sub 의 영문 부분에는 입력 산지 문자열의 핵심 지명을 그대로 포함시켜라(매칭용). 예: 입력 "Lodi, California" → sub "로다이 Lodi".
- major 는 그 세부산지가 속한 지방/주(예: 캘리포니아 California, 남호주 South Australia, 카탈루냐 Cataluña, 남부 론 Southern Rhône).
- super 는 부르고뉴/보르도/론/루아르처럼 여러 지방을 묶는 광역만(없으면 빈 문자열).
- 확실히 모르면 그 항목은 빼라(추측 금지).`;
  const user = `다음 산지 문자열들을 분류해줘:\n${regionList
    .map((r) => `- ${r}${examples?.get(r) ? `  (예: ${examples.get(r)})` : ''}`)
    .join('\n')}`;

  const claude = getClaudeClient();
  const resp = await claude.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

/**
 * 주어진 와인들의 산지 중 wine_regions 에 매칭 안 되는 것을 LLM 으로 분류해 행 추가.
 * 이미 매칭되거나 산지가 비어있으면 LLM 호출 없이 건너뜀(비용/지연 최소화).
 */
export async function ensureRegionsClassified(wines: WineLite[]): Promise<ClassifySummary> {
  const empty: ClassifySummary = { unmatchedRegions: 0, classified: 0, addedRows: 0, detail: [] };
  if (!wines.length) return empty;

  const { data } = await supabase
    .from('wine_regions')
    .select('id, country, major_region, sub_region, appellation, cru_vineyard');
  const rows = (data || []) as Row[];

  // 미분류 + 산지 문자열이 있는 와인의 distinct 산지(국가 함께 기록 → LLM 힌트)
  const distinct = new Map<string, string>(); // region → "대표와인명 [국가]"
  for (const w of wines) {
    const region = (w.region || '').trim();
    if (!region) continue;
    const country = (w.country || '').trim();
    if (matchRegionRow(region, w.name || '', rows, country)) continue;
    if (!distinct.has(region)) distinct.set(region, `${w.name || region}${country ? ` [${country}]` : ''}`);
  }
  const regionList = Array.from(distinct.keys());
  if (regionList.length === 0) return empty;

  const countries = Array.from(new Set(rows.map((r) => r.country).filter(Boolean)));
  const parsed = await classifyRegionStrings(regionList, countries, distinct);

  const existing = new Set(rows.map((r) => `${r.country}|${r.major_region}|${r.sub_region || ''}`));
  const toInsert: Row[] = [];
  const detail: string[] = [];
  for (const p of parsed) {
    const country = (p.country || '').trim();
    const major = (p.major || '').trim();
    const sub = (p.sub || '').trim();
    if (!country || !major || !sub) continue;
    detail.push(`${p.region} → ${country} · ${major} · ${sub}`);
    const key = `${country}|${major}|${sub}`;
    if (existing.has(key)) continue;
    existing.add(key);
    toInsert.push({ country, major_region: major, sub_region: sub, notes: 'AI 자동분류' });
  }
  if (toInsert.length > 0) await supabase.from('wine_regions').insert(toInsert);

  return { unmatchedRegions: regionList.length, classified: detail.length, addedRows: toInsert.length, detail };
}
