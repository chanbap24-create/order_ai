// 단위 변환: inches → points (72pt = 1inch)
export const PT = 72;

export function i(inches: number): number {
  return inches * PT;
}

// 와인 테마 컬러 팔레트
export const C = {
  BG_BOTTLE_AREA: "#F5F0EA",
  BURGUNDY: "#722F37",
  BURGUNDY_DARK: "#5A252C",
  BURGUNDY_LIGHT: "#F2E8EA",
  GOLD: "#B8976A",
  GOLD_LIGHT: "#D4C4A8",
  TEXT_PRIMARY: "#2C2C2C",
  TEXT_SECONDARY: "#5A5A5A",
  TEXT_MUTED: "#8A8A8A",
  TEXT_ON_DARK: "#FFFFFF",
  CARD_BORDER: "#E0D5C8",
  DIVIDER: "#D4C4A8",
  DIVIDER_LIGHT: "#E8DDD0",
  WHITE: "#FFFFFF",
};

// 페이지 크기 (인치) - 세로 A4 스타일
export const PAGE_W = 7.5;
export const PAGE_H = 10.0;

// 빈티지 2자리→4자리 변환
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

// 투명도가 적용된 색상 (pdfkit은 opacity로 처리)
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function blendWithWhite(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g).toString(16).padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
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
}
