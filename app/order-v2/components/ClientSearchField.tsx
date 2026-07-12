"use client";

import type { RefObject } from "react";
import { CLIENT_DROPDOWN_MAX_HEIGHT, ORDER_COLORS, ORDER_FONT } from "../constants";
import type { Client } from "../types";

type Props = {
  query: string;
  setQuery: (v: string) => void;
  results: Client[];
  selected: Client | null;
  setSelected: (c: Client | null) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  onPick: (c: Client) => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
};

/** 거래처 검색 인풋 + 드롭다운 */
export function ClientSearchField({
  query,
  setQuery,
  results,
  selected,
  setSelected,
  showDropdown,
  setShowDropdown,
  onPick,
  dropdownRef,
}: Props) {
  return (
    <div style={{ marginBottom: 18, position: "relative" }} ref={dropdownRef}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: ORDER_COLORS.textMuted,
          marginBottom: 7,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        거래처
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={query}
          className="order-input"
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="거래처명 또는 코드 검색"
          style={{
            flex: 1,
            fontSize: 16,
            padding: "11px 14px",
            borderRadius: 12,
            border: "1px solid var(--border-default)",
            background: ORDER_COLORS.surfaceBg,
            color: ORDER_COLORS.text,
            outline: "none",
            transition: "all 0.2s ease",
            fontFamily: ORDER_FONT.base,
          }}
        />
        {selected && (
          <span
            style={{
              fontSize: 11,
              color: ORDER_COLORS.confHigh,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {selected.client_code}
          </span>
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#fff",
            borderRadius: 12,
            marginTop: 4,
            border: "1px solid var(--border-default)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            maxHeight: CLIENT_DROPDOWN_MAX_HEIGHT,
            overflowY: "auto",
          }}
        >
          {results.map((c) => (
            <button
              key={c.client_code}
              onClick={() => onPick(c)}
              className="order-client-item"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "11px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                color: ORDER_COLORS.text,
                textAlign: "left",
                borderBottom: "1px solid var(--border-subtle)",
                transition: "background 0.15s ease",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {c.client_name}
                {c.matched_alias && (
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      marginLeft: 6,
                    }}
                  >
                    ({c.matched_alias})
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: ORDER_COLORS.textMuted,
                  fontFamily: "monospace",
                }}
              >
                {c.client_code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
