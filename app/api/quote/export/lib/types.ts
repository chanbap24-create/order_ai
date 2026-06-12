export interface DocSettings {
  companyName: string;
  address: string;
  addressEn: string;
  websiteUrl: string;
  sender: string;
  title: string;
  content1: string;
  content2: string;
  content3: string;
  unit: string;
  representative: string;
  sealText: string;
}

export interface ColDef {
  uiKey: string | null; // null = always shown (No.)
  label: string;
  width: number;
  type: 'index' | 'text' | 'currency' | 'percent' | 'number' | 'formula' | 'link' | 'image';
  dataField?: string;
}

// 이미지 셀 치수 — imagePreload(정규화 비율)와 buildDataRows(행높이·앵커)가 공유.
// twoCell(셀 채움) 중앙배치 + 무왜곡을 위해 이미지 비율 = 셀 비율 이어야 함.
export const IMAGE_COL_WIDTH = 11; // image_url 컬럼 width (아래 ALL_EXCEL_COLUMNS 와 일치)
export const IMG_ROW_HEIGHT = 110; // pt — 이미지 행 높이 (이미지 비율도 이 값에 자동 동기화)
export const IMAGE_CELL_PX = {
  w: IMAGE_COL_WIDTH * 7 + 5, // 82px
  h: Math.round(IMG_ROW_HEIGHT * (96 / 72)), // 133px
};

export const ALL_EXCEL_COLUMNS: ColDef[] = [
  { uiKey: null, label: 'No.', width: 5, type: 'index' },
  { uiKey: 'item_code', label: '품목코드', width: 11, type: 'text', dataField: 'item_code' },
  { uiKey: 'category', label: '분류', width: 12, type: 'text' },
  { uiKey: 'barcode', label: '바코드', width: 15, type: 'text', dataField: 'barcode' },
  { uiKey: 'country', label: '국가', width: 8, type: 'text', dataField: 'country' },
  { uiKey: 'brand', label: '브랜드', width: 14, type: 'text', dataField: 'brand' },
  { uiKey: 'region', label: '지역', width: 16, type: 'text', dataField: 'region' },
  { uiKey: 'grape_varieties', label: '포도품종', width: 14, type: 'text', dataField: 'grape_varieties' },
  { uiKey: 'image_url', label: '이미지', width: 11, type: 'image' },
  { uiKey: 'spec', label: '스펙', width: 18, type: 'text', dataField: 'spec' },
  { uiKey: 'vintage', label: '빈티지', width: 8, type: 'text', dataField: 'vintage' },
  { uiKey: 'product_name', label: '상품명', width: 35, type: 'text', dataField: 'product_name' },
  { uiKey: 'english_name', label: '영문명', width: 30, type: 'text', dataField: 'english_name' },
  { uiKey: 'korean_name', label: '한글명', width: 30, type: 'text', dataField: 'korean_name' },
  { uiKey: 'supply_price', label: '공급가', width: 12, type: 'currency', dataField: 'supply_price' },
  { uiKey: 'min_price', label: '최저판매가', width: 12, type: 'currency', dataField: 'min_price' },
  { uiKey: 'retail_price', label: '소비자가', width: 12, type: 'currency', dataField: 'retail_price' },
  { uiKey: 'discount_rate', label: '할인율', width: 8, type: 'percent', dataField: 'discount_rate' },
  { uiKey: 'discounted_price', label: '할인가', width: 12, type: 'formula' },
  { uiKey: 'retail_discounted_price', label: '할인판매가', width: 12, type: 'formula' },
  { uiKey: 'quantity', label: '수량', width: 6, type: 'number', dataField: 'quantity' },
  { uiKey: 'normal_total', label: '정상공급가합계', width: 14, type: 'formula' },
  { uiKey: 'discount_total', label: '할인공급가합계', width: 14, type: 'formula' },
  { uiKey: 'min_price_total', label: '최저판매가합계', width: 14, type: 'formula' },
  { uiKey: 'retail_normal_total', label: '정상소비자가합계', width: 15, type: 'formula' },
  { uiKey: 'retail_discount_total', label: '할인소비자가합계', width: 15, type: 'formula' },
  { uiKey: 'tasting_note', label: '테이스팅노트', width: 18, type: 'link' },
  { uiKey: 'note', label: '비고', width: 15, type: 'text', dataField: 'note' },
];

export const DEFAULT_DOC: DocSettings = {
  companyName: '(주) 까 브 드 뱅',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-786-3136 / FAX: 02-785-5719',
  addressEn: 'Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA',
  websiteUrl: 'www.cavedevin.com',
  sender: '(주)까브드뱅',
  title: '와인 제안의 건',
  content1: '1. 귀사의 일익 번창하심을 기원합니다.',
  content2: '2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.',
  content3: '- 아         래 -',
  unit: '단위 : VAT별도, WON, BTL.',
  representative: '대표이사 유병우',
  sealText: '-직인생략-',
};
