-- 2025-08 이전 글라스 출고: total_amount NULL → selling_price 기반 보정(총액=공급×1.1).
-- 미수 계산이 옛 출고를 누락하던 문제(라핀부쉬: 89,100 → 2,619,540) 수정.
-- selling_price = 판매단가 Q × 수량 = 공급 라인합계 (2025-08 이전 포맷).
UPDATE glass_shipments
SET total_amount = ROUND(COALESCE(selling_price,0) * 1.1),
    tax_amount   = COALESCE(tax_amount, ROUND(COALESCE(selling_price,0) * 0.1))
WHERE total_amount IS NULL;
