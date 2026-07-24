// dept_batch 와인 중 영문명이 빈 것들을 Claude로 채움 — 한글 음차명 → 원어 명칭 복원.
// 불확실한 건 빈 값으로 남기고 목록 출력(수동 확인용). 이후 배치 조사에서 신뢰도 재검증됨.
// 실행: npx tsx --env-file=.env.local scripts/fill-english-names.ts [--dry]
import { supabase } from '../app/lib/db';
import { getClaudeClient } from '../app/lib/claudeClient';

/** 응답 텍스트에서 JSON 배열 추출 */
function parseArray(raw: string): { code: string; en: string }[] {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

const DRY = process.argv.includes('--dry');
const MODEL = 'claude-sonnet-4-6';
const BATCH = 25;

const SYSTEM = `당신은 와인 데이터 전문가입니다. 한국 수입사가 쓰는 한글 와인명(음차)을 보고 원래의 정식 와인명(영문/원어 라틴 표기)을 복원합니다.

규칙:
- 실존 와인의 정식 명칭으로. 생산자명 포함 (예: "샤또퐁떼까네" → "Chateau Pontet-Canet").
- 악상 기호 없이 ASCII로 표기 (Château → Chateau, Pouilly-Fuissé → Pouilly-Fuisse).
- 용량(375ml 등)·병입 표기는 제외. 빈티지 연도도 이름에 넣지 않음.
- 확신이 없으면(실존 와인을 특정 못 하면) 빈 문자열 "".
- 반드시 JSON 배열로만 응답: [{"code":"품번","en":"English Name"}, ...]`;

async function main() {
  const { data: wines } = await supabase
    .from('wines')
    .select('item_code, item_name_kr, country, vintage, supplier_kr')
    .eq('dept_batch', true)
    .or('item_name_en.is.null,item_name_en.eq.');
  const targets = wines || [];
  console.log(`영문명 필요: ${targets.length}종${DRY ? ' (dry-run)' : ''}`);
  if (!targets.length) return;

  const client = getClaudeClient();
  let filled = 0;
  const uncertain: string[] = [];

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const list = batch.map((w) =>
      `- 품번:${w.item_code} | 한글명:${w.item_name_kr} | 국가:${w.country || '?'}${w.vintage ? ` | 빈티지:${w.vintage}` : ''}`).join('\n');
    try {
      const res = await client.messages.create({
        model: MODEL, max_tokens: 2500, temperature: 0,
        system: SYSTEM,
        messages: [{ role: 'user', content: `다음 와인들의 원어 명칭을 복원하세요:\n${list}` }],
      });
      const text = res.content.find((b) => b.type === 'text');
      const raw = text && 'text' in text ? text.text : '[]';
      const arr = parseArray(raw);
      for (const { code, en } of arr) {
        const name = (en || '').trim();
        if (!name) { uncertain.push(code); continue; }
        if (DRY) { console.log('[dry]', code, '→', name); filled++; continue; }
        const { error } = await supabase.from('wines')
          .update({ item_name_en: name, updated_at: new Date().toISOString() })
          .eq('item_code', code);
        if (error) console.error(code, '저장 실패:', error.message);
        else filled++;
      }
      console.log(`${Math.min(i + BATCH, targets.length)}/${targets.length} 처리 (채움 ${filled})`);
    } catch (e) {
      console.error(`배치 ${i} 실패:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`완료: ${filled}건 채움 / 불확실 ${uncertain.length}건`);
  if (uncertain.length) console.log('불확실(수동 확인):', uncertain.join(', '));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
