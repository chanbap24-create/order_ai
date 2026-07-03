// 빈티지 유효성 검사 + 표기 정규화.
// 신규 와인 AI 노트/PPT는 vintage에서 파생되므로, 생성 전에 빈티지를 검증·확인해 오입력 전파를 막는다.

export interface VintageCheck {
  year: number | null;   // 4자리 연도(파싱 성공 시). NV/빈값이면 null
  display: string;        // 'NV' | '2023' | 원문
  level: 'ok' | 'warn' | 'error';
  message: string;        // 경보 문구(ok면 '')
}

/** raw 빈티지 문자열('22','2023','NV' 등)을 검사. currentYear 미지정 시 올해 기준. */
export function checkVintage(raw: string | null | undefined, currentYear = new Date().getFullYear()): VintageCheck {
  const t = (raw || '').trim().toUpperCase();
  if (!t) return { year: null, display: '', level: 'warn', message: '빈티지가 비어 있습니다.' };
  if (t === 'NV' || t === 'MV' || t === 'N/V') return { year: null, display: 'NV', level: 'ok', message: '' };

  let year: number | null = null;
  if (/^\d{4}$/.test(t)) year = parseInt(t, 10);
  else if (/^\d{1,2}$/.test(t)) {
    const n = parseInt(t, 10);
    year = n > (currentYear % 100) ? 1900 + n : 2000 + n; // 2자리 → 세기 보정
  }
  if (year === null) return { year: null, display: t, level: 'error', message: `빈티지 형식이 이상합니다: "${raw}"` };

  const display = String(year);
  if (year < 1950 || year > currentYear + 1) return { year, display, level: 'error', message: `빈티지 ${display}는 정상 범위를 벗어납니다.` };
  if (year > currentYear) return { year, display, level: 'warn', message: `빈티지 ${display}는 미래 연도입니다.` };
  return { year, display, level: 'ok', message: '' };
}
