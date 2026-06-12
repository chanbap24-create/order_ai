// 발주 후보(카탈로그)에서 제외할 비(非)상품 — 포장/판촉/전시/비활성 품목.
//
// 목적:
//  1) LLM에 넘기는 후보 토큰 절감 (비용↓)
//  2) "더미"(전시용)·포장재가 후보에 끼어 오매칭되는 것 방지 (정확도↑)
//
// 안전 기준: 진짜 발주 가능한 와인/글라스는 절대 제외하지 않는다.
//  - country 가 있는 실측 품목 중 이 필터에 걸리는 건 전시 소품(예: 그라함 철문)뿐임을 확인.
//  - 글라스는 "세트 박스"가 정상 상품일 수 있어, 바 "박스/케이스" 단독은 CDV 에서만 제외.

// 공통 비상품 키워드 (와인·글라스 모두 발주 대상 아님)
// ⚠️ "식스 그레이프"(그라함 포트와인 실제 상품)처럼 와인명과 겹치는 단어는 절대 넣지 말 것.
//    판촉물은 '리플렛/책자/브로셔' 등 매체명으로만 잡는다.
const NON_PRODUCT = /더미|쇼핑백|오프너|보틀백|쇼케이스|마닐라|핀세트|기프트케이스|리패키징|에어팩|담요|브랜드북|택배|보냉|캐리어|쿨러백|칠러|와인백|지함|우든|우드\s*케이스|종이\s*케이스|책자|폴더|브로셔|리플렛|메탈\s*튜브|홀더|햄퍼|나이프|pallet/i;

// CDV 전용: 포장 품번 접두사 '9' + 박스/케이스 (CDV 카탈로그에서 안전 확인됨)
const CDV_PACKAGING_NAME = /케이스|박스/;

export function isNonOrderable(itemNo: string, itemName: string, tab: "CDV" | "DL"): boolean {
  const name = (itemName || "").trim();
  if (!name) return false;
  if (name.startsWith("(X)") || name.startsWith("(타사)")) return true; // 비활성/타사
  if (NON_PRODUCT.test(name)) return true;
  if (tab === "CDV") {
    if ((itemNo || "").toLowerCase().startsWith("9")) return true; // CDV 포장/판촉 품번
    if (CDV_PACKAGING_NAME.test(name)) return true;
  }
  return false;
}
