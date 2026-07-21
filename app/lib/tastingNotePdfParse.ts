// 수동 업로드 PDF 테이스팅 노트에서 본문(양조·와이너리·빈티지·색/향/맛·수상) 추출.
// 회사 템플릿(라벨: 지역/품종/빈티지/와이너리/양조 + TASTING NOTE COLOR/NOSE/PALATE/AWARDS) 기준 라벨 파싱.
// PPTX 파서(parseTastingNotesFromPptx)와 같은 필드 형태를 반환해 backfill 로직 재사용.
import { extractText, getDocumentProxy } from 'unpdf';
import { logger } from './logger';
import { getClaudeClient } from './claudeClient';

export interface PdfNoteFields {
  vintage_note?: string;
  winery_description?: string;
  winemaking?: string;
  color_note?: string;
  nose_note?: string;
  palate_note?: string;
  awards?: string;
}

/** 라벨 사이 구간(공백 제거된 철자 라벨 대응)을 잘라내는 헬퍼. */
function between(text: string, startRe: RegExp, endRes: RegExp[]): string {
  const m = startRe.exec(text);
  if (!m) return '';
  const from = m.index + m[0].length;
  let to = text.length;
  for (const er of endRes) {
    er.lastIndex = from;
    const em = er.exec(text);
    if (em && em.index < to) to = em.index;
  }
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

/** PDF 버퍼 → 노트 필드. 텍스트 추출 실패/템플릿 아님이면 빈 객체. */
export async function parseTastingNotesFromPdf(buffer: Buffer | Uint8Array): Promise<PdfNoteFields> {
  let text = '';
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const r = await extractText(pdf, { mergePages: true });
    text = Array.isArray(r.text) ? r.text.join(' ') : r.text;
  } catch (e) {
    logger.warn(`[PdfNote] 텍스트 추출 실패: ${e instanceof Error ? e.message : e}`);
    return {};
  }
  if (!text || text.length < 30) return {};

  // 철자 사이 공백 라벨(C O L O R 등)도 매칭되게: 각 글자 뒤 \s* 허용
  const spaced = (w: string) => w.split('').join('\\s*');
  const COLOR = new RegExp(spaced('COLOR'), 'i');
  const NOSE = new RegExp(spaced('NOSE'), 'i');
  const PALATE = new RegExp(spaced('PALATE'), 'i');
  const AWARDS = new RegExp(spaced('AWARDS'), 'i');
  const TASTING = new RegExp(spaced('TASTING') + '\\s*' + spaced('NOTE'), 'i');

  // 회사 템플릿 여부 판별 — 'TASTING NOTE' 헤더가 있으면 라벨 파싱, 없으면(자유형식) Claude 폴백.
  if (!TASTING.test(text)) {
    return await parseWithClaude(text);
  }

  const ALC = /Alc\.?/i;
  const 빈티지 = /빈티지\s*(?:\d{2,4}|NV)?/;
  const 와이너리 = /와이너리/;
  const 양조 = /양조/;
  const FOOT = /T\.\s*0?\d|www\.cavedevin|www\./i;

  const fields: PdfNoteFields = {
    vintage_note: between(text, 빈티지, [와이너리, 양조, TASTING]),
    winery_description: between(text, 와이너리, [양조, ALC, TASTING]),
    winemaking: between(text, 양조, [ALC, TASTING, COLOR]),
    color_note: between(text, COLOR, [NOSE, PALATE, AWARDS, FOOT]),
    nose_note: between(text, NOSE, [PALATE, AWARDS, FOOT]),
    palate_note: between(text, PALATE, [AWARDS, FOOT]),
    awards: between(text, AWARDS, [FOOT]),
  };

  // 빈 값은 제거
  for (const k of Object.keys(fields) as (keyof PdfNoteFields)[]) {
    if (!fields[k]) delete fields[k];
  }
  return fields;
}

const CLAUDE_PROMPT = `다음은 와인 테이스팅 노트 PDF에서 추출한 텍스트입니다. 아래 항목을 원문 그대로(요약/창작 금지) 뽑아 JSON으로만 답하세요. 해당 내용이 없으면 그 키는 생략하세요.
- winery_description: 와이너리/생산자 소개
- winemaking: 양조/제조 방식
- vintage_note: 빈티지(작황) 설명
- color_note: 색/외관
- nose_note: 향/노즈
- palate_note: 맛/팔레트
- awards: 수상/평점
JSON 형식: {"winery_description":"...", "winemaking":"...", ...}`;

/** 라벨 없는 자유형식 PDF — Claude로 항목 구조화(원문 유지). */
async function parseWithClaude(text: string): Promise<PdfNoteFields> {
  if (!process.env.ANTHROPIC_API_KEY) return {};
  try {
    const res = await getClaudeClient().messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 2000, temperature: 0,
      system: CLAUDE_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
    });
    const raw = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || '{}';
    const parsed = JSON.parse(json) as PdfNoteFields;
    const out: PdfNoteFields = {};
    for (const k of ['winery_description', 'winemaking', 'vintage_note', 'color_note', 'nose_note', 'palate_note', 'awards'] as const) {
      const v = parsed[k];
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch (e) {
    logger.warn(`[PdfNote] Claude 폴백 실패: ${e instanceof Error ? e.message : e}`);
    return {};
  }
}
