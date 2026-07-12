import type { StatusFilter } from "./types";

export const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "detected",
  "researched",
  "mismatch",
  "approved",
];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "전체",
  detected: "감지됨",
  researched: "조사완료",
  mismatch: "재조사",
  approved: "승인완료",
};

export type StatusBadge = { label: string; color: string; bg: string; icon: string };

export function statusBadge(ws: string): StatusBadge {
  if (ws === "approved")
    return { label: "승인완료", color: "var(--status-success)", bg: "#dcfce7", icon: "🟢" };
  if (ws === "mismatch")
    return { label: "재조사필요", color: "var(--status-danger)", bg: "#fee2e2", icon: "🔴" };
  if (ws === "researched")
    return { label: "조사완료", color: "#ca8a04", bg: "#fef9c3", icon: "🟡" };
  return { label: "감지됨", color: "var(--status-info)", bg: "#dbeafe", icon: "🔵" };
}

export const VERIFICATION_STATUSES: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  verified: { label: "검증완료", color: "var(--status-success)", bg: "#dcfce7" },
  warning: { label: "생산자 확인 필요", color: "var(--status-warning)", bg: "#fef3c7" },
  mismatch: { label: "생산자 불일치", color: "var(--status-danger)", bg: "#fee2e2" },
  approved: { label: "승인완료", color: "var(--status-info)", bg: "#dbeafe" },
  pending: { label: "검증대기", color: "#9ca3af", bg: "#f3f4f6" },
};

export const EMPTY_EDIT_FORM = {
  grape_varieties: "",
  region: "",
  alcohol: "",
  serving_temp: "",
  winery_description: "",
  winemaking: "",
  vintage_note: "",
  color_note: "",
  nose_note: "",
  palate_note: "",
  food_pairing: "",
  glass_pairing: "",
  awards: "",
  aging_potential: "",
};
