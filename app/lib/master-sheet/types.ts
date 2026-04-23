export interface MasterItem {
  itemNo: string;      // B열: 품목코드
  englishName: string; // H열: 영문 품목명
  koreanName: string;  // I열: 한글 품목명
  vintage?: string;
  country?: string;
  producer?: string;
  region?: string;
  supplyPrice?: number;
  retailPrice?: number;
}

export interface RiedelItem {
  itemNo: string;
  englishName: string;
  koreanName: string;
  supplyPrice?: number;
}
