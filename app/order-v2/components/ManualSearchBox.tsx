"use client";

import type { RefObject } from "react";
import { ORDER_COLORS } from "../constants";
import { fmt } from "../lib/format";
import type { SearchResult } from "../types";

type Props = {
  lineIdx: number;
  isSearching: boolean;
  query: string;
  setQuery: (v: string) => void;
  results: SearchResult[];
  loading: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onPick: (wine: SearchResult) => void;
  /** 거래처 입고 이력 (item_no 대문자 trim). 검색 결과 row 에 "구매" 배지 노출용. */
  historySet?: Set<string>;
};

/** "직접 검색하여 변경" — 닫힘 시 링크, 열림 시 입력 + 결과 목록 */
export function ManualSearchBox({
  isSearching,
  query,
  setQuery,
  results,
  loading,
  containerRef,
  onOpen,
  onPick,
  historySet,
}: Props) {
  return (
    <div
      style={{ padding: "4px 14px 8px", position: "relative" }}
      ref={isSearching ? containerRef : undefined}
    >
      {!isSearching ? (
        <button
          onClick={onOpen}
          style={{
            fontSize: 11,
            color: ORDER_COLORS.primary,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            padding: "3px 0",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            opacity: 0.8,
            transition: "opacity 0.15s ease",
          }}
        >
          직접 검색하여 변경
        </button>
      ) : (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="와인명 또는 품번 검색"
            autoFocus
            style={{
              width: "100%",
              fontSize: 16,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1.5px solid #5A1515",
              background: "#fff",
              color: ORDER_COLORS.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {loading && (
            <div style={{ fontSize: 11, color: ORDER_COLORS.textMuted, padding: "6px 0" }}>
              <span style={{ animation: "orderPulse 1.2s ease-in-out infinite" }}>
                검색 중...
              </span>
            </div>
          )}
          {results.length > 0 && (
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                marginTop: 4,
                border: "1px solid rgba(90,21,21,0.08)",
                borderRadius: 8,
                background: "#fff",
                boxShadow: "0 8px 24px rgba(90,21,21,0.08)",
              }}
            >
              {results.map((sr) => {
                const purchased = historySet?.has(
                  (sr.item_no || "").trim().toUpperCase(),
                );
                return (
                  <button
                    key={sr.item_no}
                    onClick={() => onPick(sr)}
                    className="order-search-item"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      borderBottom: "1px solid rgba(90,21,21,0.03)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: ORDER_COLORS.text,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>{sr.item_name}</span>
                      {purchased && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#5A1515",
                            background: "rgba(90,21,21,0.08)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                          title="이 거래처가 이전에 구매한 품목"
                        >
                          구매
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: ORDER_COLORS.textMuted, marginTop: 2 }}>
                      {sr.item_no} · 공급가 {fmt(sr.supply_price || 0)} · 재고 {sr.available_stock || 0}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {query && !loading && results.length === 0 && (
            <div style={{ fontSize: 11, color: "#b8b0a8", padding: "6px 0" }}>
              검색 결과 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}
