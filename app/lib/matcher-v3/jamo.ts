// 한글 자모 분해 — 음절 단위 trigram은 1글자 치환에도 전부 어긋나므로('리자르댕'↔'지라르댕')
// 자모 문자열로 풀어 pg_trgm을 돌린다. 영문·숫자는 소문자 유지, 공백·기호 제거.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

export function toJamo(s: string): string {
  let out = '';
  for (const ch of (s || '').toLowerCase()) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const i = code - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)];
      const jong = i % 28;
      if (jong > 0) out += JONG[jong];
    } else if (/[a-z0-9ㄱ-ㅎㅏ-ㅣ]/.test(ch)) {
      out += ch;
    }
    // 공백·기호는 제거 (표기 차이 무력화)
  }
  return out;
}
