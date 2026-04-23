/**
 * LLM 프롬프트 인젝션 방어 유틸.
 *
 * 완전 방어는 불가능하지만 대표적인 공격 벡터를 차단:
 *  - 제어 문자 / 비정상 유니코드 제거
 *  - 지나치게 긴 입력 절단
 *  - "ignore previous instructions" 류 의심 패턴 감지 (로그만)
 *  - LLM JSON 응답은 extractJsonObject로 안전 파싱
 */

const MAX_USER_INPUT_LEN = 500;

// 대표적인 프롬프트 인젝션 패턴 (샘플). 완전하진 않지만 로그 알림용.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|above)\s+instructions?/i,
  /forget\s+(all\s+)?(previous|above)\s+instructions?/i,
  /system\s*(prompt|role|message)\s*[:=]/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  // 한국어 변형
  /이전\s+(지시|명령|프롬프트).*무시/i,
  /새\s+역할.*당신은/i,
];

/**
 * LLM 프롬프트에 삽입될 사용자 입력을 정화.
 * 반환값은 원본이 그대로 유지되는 경우도 있지만, 길이/제어문자/의심 패턴은 처리됨.
 */
export function sanitizeUserInput(input: unknown): string {
  if (typeof input !== 'string') return '';

  // 1) 제어 문자 제거 (탭/개행은 유지하되 NULL/BEL 등은 제거)
  // eslint-disable-next-line no-control-regex
  let s = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // 2) Zero-width / BOM 제거 (프롬프트 구분자 우회 방지)
  s = s.replace(/[​-‍﻿]/g, '');

  // 3) 지나치게 반복되는 문자 (스팸/토큰 낭비 공격) 줄임
  s = s.replace(/(.)\1{50,}/g, '$1'.repeat(50));

  // 4) 길이 제한
  if (s.length > MAX_USER_INPUT_LEN) {
    s = s.slice(0, MAX_USER_INPUT_LEN);
  }

  // 5) 의심 패턴 감지 (로그 + 표시만, 차단은 안 함: false positive 많음)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(s)) {
      console.warn('[PromptSafety] Suspicious pattern detected:', {
        pattern: pattern.source,
        input: s.slice(0, 100),
      });
      break;
    }
  }

  return s.trim();
}

/**
 * LLM 응답에서 첫 JSON 오브젝트를 추출하고 검증.
 * validator가 false 반환하면 null.
 */
export function extractJsonObject<T>(
  raw: string,
  validator?: (obj: unknown) => obj is T,
): T | null {
  if (!raw) return null;

  // 코드펜스 제거
  const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (validator && !validator(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * 간단한 필드 타입 검증 헬퍼 (validator 함수 작성 편의용).
 */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
