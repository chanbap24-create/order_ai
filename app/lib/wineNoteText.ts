/**
 * 테이스팅 노트 텍스트 가공 유틸 (PDF / PPT 생성기 공용).
 */

/** 앞 n문장 / maxChars 로 본문 길이 제한 (과도한 텍스트 정리). */
export function capSentences(t: string | undefined, n: number, maxChars: number): string {
  if (!t) return "";
  const sents = t.match(/[^.。]+[.。]?/g) || [t];
  let out = sents.slice(0, n).join("").trim();
  if (out.length > maxChars) out = out.slice(0, maxChars - 1).trim() + "…";
  return out;
}

/**
 * 와이너리 설명 맨 앞의 '주어(생산자명)'를 추출.
 * - "블랜디스(Blandy's)는 …" → "Blandy's" (시작부 괄호 영문 우선)
 * - "메종 로쉬 드 벨렌은 …"   → "메종 로쉬 드 벨렌" (한글 주어)
 * - "뱅상 지라르댕은 1980년 …" → "뱅상 지라르댕"
 * ※ 문장 중간 괄호(예: '…2009년 본(Beaune)에…')의 지역명을 잡지 않도록 시작부만 본다.
 */
export function extractWineryName(desc: string | undefined): string {
  const d = (desc || "").trim();
  if (!d) return "";
  // 1) 시작부 "명칭(English)" → 괄호 안 영문 우선
  const head = d.match(/^[가-힣A-Za-z·.\-'’&\s]{1,22}?\(([A-Za-z][A-Za-z0-9'’&.\- ]{1,28})\)/);
  if (head) return head[1].trim();
  // 2) 시작 주어 — 조사/괄호/숫자/마침표 앞까지
  const subj = d.match(/^([가-힣A-Za-z·.\-'’&\s]{2,24}?)\s*(?:은|는|이|가|\(|,|\.|\d|설립|소재)/);
  if (subj && subj[1].replace(/\s/g, "").length >= 2) return subj[1].trim();
  return "";
}

/** 한글 포함 여부 (폰트 선택용). */
export function hasKorean(s: string): boolean {
  return /[가-힣]/.test(s);
}

/** 전산 검색용 2글자 코드 접두어 제거. 예: "LC Lake Chalice…" → "Lake Chalice…". */
export function stripCodePrefix(name: string | undefined): string {
  return (name || "").replace(/^[A-Za-z]{2}\s+/, "").trim();
}

/**
 * 헤더용 '영문' 와이너리명 추출.
 * 1) 설명 시작부 "명(English)" → 괄호 영문 (예: 블랜디스(Blandy's) → Blandy's)
 * 2) 영문명(nameEn)의 선두 단어 — 한글 주어 단어 수만큼 (코드 접두어 제거 후)
 *    예: KR "레이크 찰리스"(2단어) + EN "LC Lake Chalice The Nest…" → "Lake Chalice"
 */
export function extractWineryNameEn(desc: string | undefined, nameEn: string | undefined): string {
  const d = (desc || "").trim();
  const head = d.match(/^[가-힣A-Za-z·.\-'’&\s]{1,22}?\(([A-Za-z][A-Za-z0-9'’&.\- ]{1,28})\)/);
  if (head) return head[1].trim();

  const en = stripCodePrefix(nameEn);
  if (en) {
    const krWords = extractWineryName(d).split(/\s+/).filter(Boolean).length;
    const enWords = en.split(/\s+/).filter(Boolean);
    const n = krWords > 0 ? Math.min(krWords, 4) : 2;
    // 이니셜("W", "J.")과 "&"는 단어 수로 세지 않고 이름에 포함.
    // 예: KR "그라함스"(1단어) + EN "W & J Graham's 30 Year…" → "W & J Graham's" (기존엔 "W")
    const take: string[] = [];
    let counted = 0;
    for (const w of enWords) {
      take.push(w);
      if (!/^[A-Za-z]\.?$/.test(w) && w !== "&") counted++;
      if (counted >= n) break;
    }
    const result = take.join(" ").trim();
    if (counted > 0 && /[A-Za-z]/.test(result)) return result;
  }
  return "";
}

/** 최대 n자로 제한(넘으면 … ). 푸터처럼 공간 제한된 영역용. */
export function capChars(t: string, n: number): string {
  return t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
}

// 수상 신호(점수·메달·평가기관·대회 등).
const AWARD_SIGNAL = /점|평점|score|pts|\/\s*100|\/\s*5|gold|silver|bronze|trophy|메달|medal|금상|은상|동상|대상|최우수|수상|award|winner|위너|best|commended|champion|grand|챌린지|challenge|competition|concours|선정|출품|IWSC|IWC|decanter|suckling|parker|spectator|robinson|vivino|gambero|guide|9[0-9]\b|100\b|⭐|별\s*\d/i;

/**
 * 수상 내역 정리: disclaimer 제거 후, '수상 신호가 있거나 충분히 긴' 경우만 유지.
 * 둘 다 아니면 정보성 없는 잡음(예: "2 (The Nest SB)")으로 보고 공란 처리.
 */
export function cleanAwards(t: string | undefined): string {
  const c = cleanField(t);
  if (!c) return "";
  const letters = c.replace(/[^가-힣A-Za-z]/g, "").length;
  return AWARD_SIGNAL.test(c) || letters >= 18 ? c : "";
}

/**
 * 'N/A' · '확인되지 않음' · '검색된 자료에서 확인 불가' 류 disclaimer 문장을 제거.
 * 의미 있는 잔여 내용이 있으면 그것만 남기고, 전부 disclaimer면 공란("") 반환.
 *
 * 예) "N/A (… 확인되지 않음. 블랜디스 누적 수상: Gold 76개 …)"
 *   → "블랜디스 누적 수상: Gold 76개 …"
 *   "… 데이터는 검색된 자료에서 확인되지 않는다." → ""
 */
// 주의: N/A 는 라틴 단어 속 'na'(National, Chardonnay 등)를 오인하지 않도록
// 앞뒤가 글자가 아닐 때만(독립 토큰) 매칭한다.
const DISCLAIMER = /확인되지\s*않|확인할\s*수\s*없|검색된\s*자료|자료에서\s*확인|자료가?\s*없|정보가?\s*(없|확인되지)|데이터(가|는|도)?\s*(없|미확인|확인되지)|(?<![A-Za-z])N\/?A(?![A-Za-z])/i;

export function cleanField(t: string | undefined): string {
  if (!t) return "";
  let s = t.trim();
  s = s.replace(/^N\/?A(?![A-Za-z])[\s:)·\-–—]*/i, "").trim();   // 선행 N/A (단어 'Na…' 오인 방지)
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1).trim();  // 전체를 감싼 괄호 벗김
  const sents = s.match(/[^.。]+[.。]?/g) || [s];
  const kept = sents.filter((p) => !DISCLAIMER.test(p));
  let out = kept.join("").trim().replace(/^[\s,.;:·\-–—()]+/, "").replace(/[\s(]+$/, "").trim();
  // disclaimer 제거 후 선행 접속사(다만/하지만 등)가 남으면 어색하므로 제거
  out = out.replace(/^(다만|하지만|그러나|한편|또한|그리고|단,)[\s,]*/, "").trim();
  // 남은 게 실질적으로 없으면 공란
  if (out.replace(/[^가-힣A-Za-z0-9%]/g, "").length < 4) return "";
  return out;
}
