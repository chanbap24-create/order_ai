import type { CSSProperties, ReactNode } from "react";

/** 지표 칩 그리드 컨테이너 — 라벨/값 칩을 정렬된 슬롯에 배치 */
export const chipGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
  gap: 4,
};

/**
 * 정렬 지표 칩 — 라벨(왼쪽) / 값(오른쪽, tabular-nums).
 * 인벤토리 카드 칩과 동일한 스타일로 화면 간 일관성 유지.
 */
export function MetricChip({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 6,
        background: "var(--surface-muted)",
        fontSize: 11,
        lineHeight: 1.3,
      }}
    >
      <span style={{ color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        style={{
          color: valueColor || "var(--neutral-700)",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </span>
  );
}
