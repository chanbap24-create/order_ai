/**
 * 문자열 정규화 (소문자, 공백 완전 제거, 특수문자 제거)
 * 띄어쓰기 차이를 무시하기 위해 공백을 완전히 제거.
 * 악센트 제거 + 따옴표 통일 포함.
 */
export function normalize(str: string): string {
  let normalized = str
    .toLowerCase()
    // 1) 곡선 따옴표 → 일반 따옴표
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // 2) NFD 정규화 후 악센트 제거
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // 3) 영문자, 숫자, 한글만 남기기
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim();

  // 와인 관련 발음 변형 통일
  normalized = normalized
    .replace(/샤또/g, '샤토')
    .replace(/쌔또/g, '샤토')
    .replace(/샤도/g, '샤토')
    .replace(/샤뜨/g, '샤토')
    .replace(/쁘띠/g, '프티')
    .replace(/빠비용/g, '파비용')
    .replace(/쌩떼밀리옹/g, '생테밀리옹')
    .replace(/메독/g, '메도')
    .replace(/뽀이약/g, '포이약')
    .replace(/마르고/g, '마고')
    .replace(/샤르도네이/g, '샤르도네')
    .replace(/샤도네이/g, '샤르도네')
    .replace(/샤도네/g, '샤르도네')
    // 루이미쉘 관련
    .replace(/루이미쉘/g, '루이미셸')
    // 몬테 드 토네르/토네흐 통일
    .replace(/토네흐/g, '토네르')
    // 샤블리 관련 (몬테 드 토네르)
    .replace(/monteedetonnerre/g, '몬테드토네흐')
    .replace(/몬테드토네르/g, '몬테드토네흐')
    // 르메닐쉬르오제 (크리스토프 피뚜아)
    .replace(/lemesnilsuroger/g, '르메닐쉬르오제')
    .replace(/mesnil/g, '메닐')
    .replace(/메스닐/g, '메닐');

  return normalized;
}

/**
 * 입력 문자열에서 한글 부분과 영문 부분을 분리.
 */
export function separateKoreanEnglish(input: string): { korean: string; english: string } {
  // 먼저 곡선 따옴표와 특수문자 제거
  const cleaned = input
    .replace(/[""'']/g, '')
    .replace(/[^\w가-힣\s]/g, ' ');

  const korean = cleaned.match(/[가-힣\s]+/g)?.join(' ').trim() || '';
  const english = cleaned.match(/[a-zA-Z0-9\s]+/g)?.join(' ').trim() || '';

  return { korean, english };
}
