// 딥 네이비 팔레트 (네이비 포인트 + 쿨 그레이 에디토리얼).
// 키 이름은 구 와인 테마 시절 것을 유지 (BURGUNDY=메인 포인트, GOLD=보조 포인트/구분선).
export const C = {
  BG_BOTTLE_AREA: "F4F5F8",
  BG_WARM_GRAY: "F7F8FA",
  BURGUNDY: "1F2A44",
  BURGUNDY_DARK: "141C30",
  BURGUNDY_LIGHT: "EEF1F6",
  WINE_ACCENT: "1F2A44",
  HEADER_DARK_L: "141C30",
  HEADER_DARK_R: "243152",
  GOLD: "8C95A8",
  GOLD_LIGHT: "C9CEDA",
  TEXT_PRIMARY: "2C2C2C",
  TEXT_SECONDARY: "5A5A5A",
  TEXT_MUTED: "8A8A8A",
  TEXT_ON_DARK: "FFFFFF",
  CARD_BORDER: "E1E4EB",
  DIVIDER: "D6DAE3",
  DIVIDER_LIGHT: "E8EBF1",
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
