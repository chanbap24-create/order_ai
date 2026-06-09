export const C = {
  BG_BOTTLE_AREA: "F5F0EA",
  BG_WARM_GRAY: "F8F6F4",
  BURGUNDY: "722F37",
  BURGUNDY_DARK: "5A252C",
  BURGUNDY_LIGHT: "F2E8EA",
  WINE_ACCENT: "5A1515",
  HEADER_DARK_L: "3A0C0C",
  HEADER_DARK_R: "5A1515",
  GOLD: "B8976A",
  GOLD_LIGHT: "D4C4A8",
  TEXT_PRIMARY: "2C2C2C",
  TEXT_SECONDARY: "5A5A5A",
  TEXT_MUTED: "8A8A8A",
  TEXT_ON_DARK: "FFFFFF",
  CARD_BORDER: "E0D5C8",
  DIVIDER: "D4C4A8",
  DIVIDER_LIGHT: "E8DDD0",
  SEPARATOR: "E5E5E5",
  SHADOW: "D0D0D0",
  WHITE: "FFFFFF",
};

export const FONT_MAIN = "Malgun Gothic";
export const FONT_EN = "Georgia";

// 슬라이드 크기 (인치) - 세로 A4
export const SLIDE_W = 7.5;
export const SLIDE_H = 10.0;

export function formatVintage4(v: string): string {
  if (!v || v === "-") return "-";
  if (/^(NV|MV)$/i.test(v)) return v.toUpperCase();
  if (/^\d{4}$/.test(v)) return v;
  const num = parseInt(v, 10);
  if (!isNaN(num)) {
    return num >= 50
      ? `19${String(num).padStart(2, "0")}`
      : `20${String(num).padStart(2, "0")}`;
  }
  return v;
}

export interface SlideData {
  nameKr: string;
  nameEn: string;
  country: string;
  countryEn: string;
  region: string;
  grapeVarieties: string;
  vintage: string;
  vintageNote: string;
  wineryDescription: string;
  winemaking: string;
  alcoholPercentage: string;
  agingPotential: string;
  colorNote: string;
  noseNote: string;
  palateNote: string;
  foodPairing: string;
  glassPairing: string;
  servingTemp: string;
  awards: string;
  bottleImageBase64?: string;
  bottleImageMimeType?: string;
  bottleImageW?: number; // 원본 픽셀 폭(비율 보존용)
  bottleImageH?: number; // 원본 픽셀 높이
  // 와이너리 로고(브랜드 자료실 brands.logo_url). 있으면 헤더 우측에 로고로 표시.
  brandLogoBase64?: string;
  brandLogoMimeType?: string;
  brandLogoW?: number;
  brandLogoH?: number;
}

// pptxgenjs 타입을 강제로 any로 래핑 (각 addXxx 메서드 호출)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Slide = any;
