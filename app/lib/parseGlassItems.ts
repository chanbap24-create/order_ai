/* ================= Glass(와인잔) 전용 파싱 ================= */

// ✅ Glass 발주는 특수한 패턴이 많음:
// 1. 코드 우선: "0447/07(레스토랑 뉴월드 피노) : 12잔"
// 2. 품목명만: "리델 퍼포먼스 피노누아 12개"
// 3. 약어: "피노누아 글라스 1박스"

// ✅ Glass 코드 정규화: 330/07 → 0330/07 (선행 0 보정)
function normalizeGlassCode(code: string): string {
  if (!code) return code;
  const parts = code.split('/');
  if (parts.length === 2) {
    // 슬래시 앞부분이 3자리면 4자리로 패딩
    let prefix = parts[0];
    if (/^\d{3}$/.test(prefix)) {
      prefix = '0' + prefix;
    }
    return `${prefix}/${parts[1]}`;
  }
  return code;
}

// ✅ Glass 코드 패턴: 3~4자리 + 슬래시 + 1~3자리 + 혼합접미사(JG,SKY,BWT,MA,S3,S1,S3DG 등)
// (?:[A-Z][A-Z0-9]*)? = 알파벳으로 시작하는 영숫자 접미사 (S3, S3DG, BWT, SKY, MA 등)
const GLASS_CODE_RE = /\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?/i;

type ParsedGlassItem = {
  raw: string;
  code?: string;  // 품목 코드 (0447/07)
  name: string;   // 품목명
  qty: number;
};

export function parseGlassItemsFromMessage(text: string): ParsedGlassItem[] {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedGlassItem[] = [];

  // ✅ 제외할 표현 (인사말, 예의 표현, 발주 관련 표현)
  const excludePatterns = [
    /^(과장님|님|선생님|사장님|대표님)/i,
    /안녕하세요/i,
    /감사합니다/i,
    /고맙습니다/i,
    /부탁드립니다/i,
    /부탁드리겠습니다/i,
    /드리겠습니다/i,
    /요청드립니다/i,
    /발주\s*(요청|부탁)/i,
    /^(감사|고마워|땡큐|thanks)/i,
    /^(주세요|해주세요)$/i,
    /^(네|예|확인)$/i,
  ];

  for (const line of lines) {
    // ✅ 거래처 코드 제외 (숫자만 있는 라인: 12096, 30001 등)
    if (/^\d+$/.test(line)) {
      continue;
    }

    // ✅ 인사말/예의 표현 제외
    if (excludePatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    // ✅ 패턴 1a: 코드 + 괄호 설명 + 수량
    // "0447/07(레스토랑 뉴월드 피노) : 12잔"
    // "330/0(레스토랑 까베르네) : 12잔"  ← 3자리도 허용
    // "4900/28JG(파토마노 샴페인 제이드) : 6잔"  ← 다중알파벳
    // "0515/02S3(바 텀블러 스페이) : 6잔"  ← 숫자+알파벳 혼합접미사
    const codePattern = /^(\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)\s*\(([^)]+)\)\s*[:：]?\s*(\d+)\s*(잔|개|병|박스|box)?/i;
    const m1 = line.match(codePattern);
    
    if (m1) {
      items.push({
        raw: line,
        code: normalizeGlassCode(m1[1]),
        name: m1[2].trim(),
        qty: Number(m1[3]),
      });
      continue;
    }

    // ✅ 패턴 1b: 코드만 + 수량 (괄호 설명 없이)
    // "0884/0 6", "0447/07 12", "4100/00R 6", "330/07 6", "4900/28JG 6", "0515/02S3 6" ← 혼합접미사
    const codeOnlyPattern = /^(\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)\s+(\d+)\s*(잔|개|병|박스|box)?$/i;
    const m1b = line.match(codeOnlyPattern);
    
    if (m1b) {
      const code = normalizeGlassCode(m1b[1]);
      items.push({
        raw: line,
        code,
        name: code, // 정규화된 코드를 이름으로도 저장
        qty: Number(m1b[2]),
      });
      continue;
    }

    // ✅ 패턴 1c: 텍스트 + 코드 + 수량 (거래처명이 앞에 붙어있는 경우)
    // "크로스비 0425/0 6", "스시소라 330/07 12", "xxx 4900/07SKY 6", "xxx 0515/02S3 6" ← 혼합접미사
    const textCodePattern = /^(.+?)\s+(\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)\s+(\d+)\s*(잔|개|병|박스|box)?$/i;
    const m1c = line.match(textCodePattern);
    
    if (m1c) {
      const prefix = m1c[1].trim();
      const code = normalizeGlassCode(m1c[2]);
      const qty = Number(m1c[3]);
      
      // 앞부분이 한글(거래처명)이면 코드만 추출
      // 앞부분이 품목 설명이면 이름에 포함
      if (/^[가-힣\s]+$/.test(prefix)) {
        // 순수 한글 = 거래처명일 가능성 높음 → 코드만 사용
        items.push({
          raw: line,
          code: code,
          name: code,
          qty,
        });
      } else {
        // 영문/숫자 혼합 = 품목 설명일 수 있음
        items.push({
          raw: line,
          code: code,
          name: `${prefix} ${code}`,
          qty,
        });
      }
      continue;
    }

    // ✅ 패턴 2: 코드 없이 품목명만
    // "리델 퍼포먼스 피노누아 12개"
    // "피노누아 글라스 1박스"
    const namePattern = /^(.+?)\s+(\d+)\s*(잔|개|병|박스|box|cs)?$/i;
    const m2 = line.match(namePattern);
    
    if (m2) {
      const name = m2[1].trim();
      // 너무 짧은 품목명 제외 (2글자 이하)
      if (name.length <= 2) continue;
      
      // ✅ 품목명 안에 코드 패턴이 숨어있는지 확인 (3~4자리 + 혼합접미사 허용)
      const embeddedCode = name.match(/(\d{3,4}\/\d{1,3}(?:[A-Z][A-Z0-9]*)?)/i);
      if (embeddedCode) {
        items.push({
          raw: line,
          code: normalizeGlassCode(embeddedCode[1]),
          name: name,
          qty: Number(m2[2]),
        });
        continue;
      }
      
      items.push({
        raw: line,
        name,
        qty: Number(m2[2]),
      });
      continue;
    }

    // ✅ 패턴 3: 수량이 앞에 있는 경우
    // "12개 리델 퍼포먼스 피노누아"
    const qtyFirstPattern = /^(\d+)\s*(잔|개|병|박스|box|cs)?\s+(.+)$/i;
    const m3 = line.match(qtyFirstPattern);
    
    if (m3) {
      items.push({
        raw: line,
        name: m3[3].trim(),
        qty: Number(m3[1]),
      });
      continue;
    }

    // ✅ 패턴 4: 수량이 없는 경우 (기본 1개)
    // 단, 한글이나 영문이 포함된 경우만 (순수 숫자 제외)
    // 그리고 너무 짧거나 의미 없는 문구는 제외
    if (line.length > 3 && /[가-힣A-Za-z]/.test(line)) {
      // 추가 필터링: 너무 일반적인 단어/짧은 단어 제외
      if (/^(네|예|아니오|확인|ok|OK|ㅇㅋ)$/i.test(line)) {
        continue;
      }
      
      items.push({
        raw: line,
        name: line.trim(),
        qty: 1,
      });
    }
  }

  return items;
}
