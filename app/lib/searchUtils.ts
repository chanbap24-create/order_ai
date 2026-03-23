import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * 검색어를 안전하게 정제 (SQL 와일드카드/특수문자 제거)
 */
export function sanitizeSearch(q: string): string {
  return q.trim().replace(/[%_,.()"\\]/g, '');
}

/**
 * 검색어를 공백으로 분리하여 단어 배열 반환
 * "와인 파이" → ["와인", "파이"]
 * "삼성"     → ["삼성"]
 */
export function splitSearchWords(q: string): string[] {
  return sanitizeSearch(q).split(/\s+/).filter(Boolean);
}

/**
 * Supabase 쿼리에 다중 단어 ilike 필터 적용
 * 단일 단어: OR 조건 (이름 또는 코드에 포함)
 * 다중 단어: 각 단어가 이름에 모두 포함 (AND)
 *
 * @param query - Supabase 쿼리 빌더
 * @param words - splitSearchWords() 결과
 * @param nameCol - 이름 컬럼 (default: 'client_name')
 * @param codeCols - 코드/추가 검색 컬럼들 (default: ['client_code'])
 */
export function applyMultiWordSearch<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  words: string[],
  nameCol: string = 'client_name',
  codeCols: string[] = ['client_code'],
): T {
  if (words.length === 0) return query;

  const joined = words.join(' ');

  if (words.length === 1) {
    // 단일 단어: OR 검색 (이름 + 코드 컬럼들)
    const conditions = [nameCol, ...codeCols].map(col => `${col}.ilike.%${joined}%`).join(',');
    return query.or(conditions) as T;
  }

  // 다중 단어: 이름 컬럼에 각 단어가 모두 포함 (AND)
  for (const w of words) {
    query = query.ilike(nameCol, `%${w}%`) as T;
  }
  return query;
}
