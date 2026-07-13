// app/lib/inventoryHeaders.ts
// 재고 엑셀 헤더 → DB 컬럼 매핑 (서버/브라우저 공용)

export const HEADER_MAP: Record<string, string> = {
  // 기본 정보
  '품번': 'item_no',
  '품명': 'item_name',
  '브랜드': 'brand',
  '수입사': 'importer',
  '용량': 'volume_ml',
  '단위': 'unit',          // EA / B/T / 잔 등
  'IP': 'units_per_box',   // 박스당 입수량(글라스: N박스 → N×IP 잔 환산)
  '입수': 'units_per_box', // 변형 헤더 대응
  '빈티지': 'vintage',
  '알콜도수%': 'alcohol_content',
  '국가': 'country',
  '표준바코드': 'barcode',
  // 재고 수량 — 관리자 업로드 형식
  '재고수량(A)': 'total_stock',
  '재고수량(가용재고제외)(B)': 'stock_excl_available',
  '출고예정(C)': 'pending_shipment',
  '가용재고(B-C)': 'available_stock',
  // 재고 수량 — 번들 엑셀 형식 (변형 대응)
  '재고수량(B)': 'total_stock',
  '재고수량(가용재고제외)': 'stock_excl_available',
  '출고예정(B)': 'pending_shipment',
  '가용재고(A-B)': 'available_stock',
  // 출고 통계
  '30일출고': 'sales_30days',
  '90일/3평균출고': 'avg_sales_90d',
  '365일/12평균출고': 'avg_sales_365d',
  // 가격
  '공급가': 'supply_price',
  '판매가': 'retail_price',
  '할인공급가': 'discount_price',
  '도매장가': 'wholesale_price',
  '최저판매가': 'min_price',
  '미착품재고': 'incoming_stock',
  // 창고 — CDV (까브드뱅). 2026 창고 개명: 용마 → KCTC
  '보세(용마)': 'bonded_warehouse',     // 통관전 보세(용마) — 이전 못한 잔여
  'KCTC': 'kctc',                       // KCTC 통관후(가용)
  '보세(KCTC)': 'bonded_kctc',          // KCTC 통관전 보세
  '용마로지스': 'kctc',                 // 구 명칭 호환 → KCTC
  'KCTC(리져브)': 'yongma_reserve',
  'KCTC(마케팅부)': 'yongma_marketing',
  'KCTC(영업1부)': 'yongma_sales1',
  'KCTC영업1부)': 'yongma_sales1', // ERP export 괄호 누락 타이포 대응 (2026-07 글라스 재고)
  'KCTC(영업2부)': 'yongma_sales2',
  '용마(리져브)': 'yongma_reserve',
  '용마(마케팅부)': 'yongma_marketing',
  '용마(영업1부)': 'yongma_sales1',
  '용마(영업2부)': 'yongma_sales2',
  '안성창고(CDV)': 'anseong_warehouse',
  // 창고 — DL (대유라이프)
  '보세(GIG)': 'bonded_warehouse',
  '안성창고(DL)': 'anseong_warehouse',
  'GIG': 'gig_warehouse',
  'GIG(마케팅부)': 'gig_marketing',
  'GIG(영업1부)': 'gig_sales1',
  // 변형 대응
  '안성창고': 'anseong_warehouse',
  'GIG마케팅': 'gig_marketing',
  'GIG영업1': 'gig_sales1',
};

export const TEXT_COLUMNS = new Set([
  'item_no', 'item_name', 'brand', 'importer', 'volume_ml',
  'vintage', 'alcohol_content', 'country', 'barcode', 'unit',
]);
