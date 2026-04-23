"use client";

import type { WarehouseTab } from "../types";

type Props = {
  activeTab: WarehouseTab;
  hasSearched: boolean;
  filteredCount: number;
  hideNoSupplyPrice: boolean;
  setHideNoSupplyPrice: (v: boolean) => void;
  hideNoStock: boolean;
  setHideNoStock: (v: boolean) => void;
  showOnlyBondedStock: boolean;
  setShowOnlyBondedStock: (v: boolean) => void;
};

/** 검색결과 카운트 + 공급가/재고/보세만 필터 칩 */
export function FilterChips({
  activeTab,
  hasSearched,
  filteredCount,
  hideNoSupplyPrice,
  setHideNoSupplyPrice,
  hideNoStock,
  setHideNoStock,
  showOnlyBondedStock,
  setShowOnlyBondedStock,
}: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: hasSearched ? "#2D2D2D" : "#BCBCBC",
          minWidth: 60,
        }}
      >
        {hasSearched
          ? `${filteredCount} result${filteredCount !== 1 ? "s" : ""}`
          : "No search"}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          className={`inv-chip${hideNoSupplyPrice ? " active" : ""}${!hasSearched ? " disabled" : ""}`}
          onClick={() => setHideNoSupplyPrice(!hideNoSupplyPrice)}
        >
          공급가 ✓
        </button>
        <button
          className={`inv-chip${hideNoStock ? " active" : ""}${!hasSearched || showOnlyBondedStock ? " disabled" : ""}`}
          onClick={() => setHideNoStock(!hideNoStock)}
        >
          재고 ✓
        </button>
        {activeTab === "CDV" && (
          <button
            className={`inv-chip${showOnlyBondedStock ? " active" : ""}${!hasSearched || hideNoStock ? " disabled" : ""}`}
            onClick={() => setShowOnlyBondedStock(!showOnlyBondedStock)}
          >
            보세만
          </button>
        )}
      </div>
    </div>
  );
}

type ErrorProps = { error: string };

/** 검색 에러 배너 (토스트 스타일) */
export function ErrorBanner({ error }: ErrorProps) {
  if (!error) return null;
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        background: "rgba(239, 68, 68, 0.06)",
        border: "1px solid rgba(239, 68, 68, 0.15)",
        borderRadius: 8,
        color: "#ef4444",
        fontSize: "0.82rem",
      }}
    >
      {error}
    </div>
  );
}
