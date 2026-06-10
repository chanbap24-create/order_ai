/**
 * 모델 응답에서 평탄한(중첩 없는) JSON 오브젝트를 관대하게 파싱.
 * - 코드펜스(```), JSON 앞뒤에 붙는 설명 텍스트 제거
 * - max_tokens로 잘린 JSON 복구 (미완성 문자열 닫기 + 괄호 보정)
 */
export function parseJsonLoose<T>(text: string): T {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const objMatch = s.match(/\{[\s\S]*?\}/);
  if (objMatch) s = objMatch[0];

  try {
    return JSON.parse(s) as T;
  } catch {
    let fixed = s;
    if (fixed.match(/"[^"]*$/)) fixed += '"';
    const brackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
    for (let i = 0; i < brackets; i++) fixed += "]";
    const braces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
    for (let i = 0; i < braces; i++) fixed += "}";
    return JSON.parse(fixed) as T;
  }
}
