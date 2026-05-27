/**
 * shipments 테이블의 가격 컬럼에서 실제 판매단가(Q열)를 추출
 *
 * ERP 데이터 포맷이 2025-08 전후로 다름:
 * - 2025-08~: unit_price = selling_price = Q(판매단가), supply_amount = Q*수량
 * - ~2025-07: selling_price = Q*수량(총액), unit_price = 비정상(출하건총액/수량)
 *             supply_amount = R(기준단가) 또는 출하건 전체 총액
 */
export function getSellingUnitPrice(
  unitPrice: number,
  sellingPrice: number,
  supplyAmount: number,
  quantity: number,
): number {
  const up = unitPrice || 0;
  const sp = sellingPrice || 0;
  const sa = supplyAmount || 0;
  const qty = Math.abs(quantity) || 1;

  // qty=1: 단가=총액
  if (qty <= 1) return sp > 0 ? sp : up;

  // 2025-08~ 포맷: sp=단가, sa=총액(sp*qty)
  if (sa > 0 && sa > sp && Math.abs(sp * qty - sa) < 100) return sp;

  // ~2025-07 포맷: sp=총액(Q*qty), up=비정상(sa/qty 등)
  if (sp > up * 2 && up > 0) return Math.round(sp / qty);

  // 둘 다 비슷한 값(최근 포맷에서 up=sp인 경우)
  if (up > 0 && sp > 0) return Math.min(up, sp);

  return sp || up;
}

/**
 * shipments 행의 총 판매 금액(공급가액) 추출.
 * 반품(quantity < 0) 인 경우 결과도 음수로 반환.
 */
export function getSellingTotal(
  unitPrice: number,
  sellingPrice: number,
  supplyAmount: number,
  quantity: number,
): number {
  const up = unitPrice || 0;
  const sp = sellingPrice || 0;
  const sa = supplyAmount || 0;
  const qty = quantity || 0;
  const absQty = Math.abs(qty);
  const sign = qty < 0 ? -1 : 1;
  const absSp = Math.abs(sp);
  const absUp = Math.abs(up);
  const absSa = Math.abs(sa);

  let absResult: number;

  if (absQty <= 1) {
    absResult = absSp > 0 ? absSp : absUp;
  } else if (absSa > 0 && absSa > absSp && Math.abs(absSp * absQty - absSa) < 100) {
    // 2025-08~ 포맷: sa = 총액 (절대값으로 매칭, 부호는 quantity 로 결정)
    absResult = absSa;
  } else if (absSp > absUp * 2 && absUp > 0) {
    // ~2025-07 포맷: sp = 총액
    absResult = absSp;
  } else if (absSp > 0) {
    absResult = absSp > absUp ? absSp : absSp * absQty;
  } else {
    absResult = absUp * absQty;
  }

  return sign * absResult;
}
