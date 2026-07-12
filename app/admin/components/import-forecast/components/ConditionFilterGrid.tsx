"use client";

import type { BrandListItem } from "../types";
import { COUNTRIES, REGIONS, SUB_REGIONS } from "../constants";
import { inputStyle, labelStyle, selectStyle } from "../styles";

type Props = {
  country: string;
  setCountry: (v: string) => void;
  regionLabel: string;
  onRegionChange: (label: string) => void;
  subRegionLabel: string;
  onSubRegionChange: (label: string) => void;
  wineType: string;
  setWineType: (v: string) => void;
  brand: string;
  brandInput: string;
  setBrand: (v: string) => void;
  setBrandInput: (v: string) => void;
  brandList: BrandListItem[];
  resetResults: () => void;
};

export function ConditionFilterGrid(p: Props) {
  const availableSubRegions =
    p.country && p.regionLabel ? SUB_REGIONS[p.country]?.[p.regionLabel] || [] : [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 0.8fr 0.8fr",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div>
        <label style={labelStyle}>국가</label>
        <select
          value={p.country}
          onChange={(e) => {
            p.setCountry(e.target.value);
            p.onRegionChange("");
            p.resetResults();
          }}
          style={selectStyle}
        >
          <option value="">선택</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>지역</label>
        <select
          value={p.regionLabel}
          onChange={(e) => p.onRegionChange(e.target.value)}
          disabled={!p.country}
          style={{ ...selectStyle, opacity: p.country ? 1 : 0.5 }}
        >
          <option value="">전체</option>
          {(REGIONS[p.country] || []).map((r) => (
            <option key={r.label} value={r.label}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>세부 지역</label>
        <select
          value={p.subRegionLabel}
          onChange={(e) => p.onSubRegionChange(e.target.value)}
          disabled={!p.regionLabel || availableSubRegions.length === 0}
          style={{
            ...selectStyle,
            opacity: p.regionLabel && availableSubRegions.length > 0 ? 1 : 0.5,
          }}
        >
          <option value="">전체</option>
          {availableSubRegions.map((r) => (
            <option key={r.label} value={r.label}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>타입</label>
        <select
          value={p.wineType}
          onChange={(e) => {
            p.setWineType(e.target.value);
            p.resetResults();
          }}
          style={selectStyle}
        >
          <option value="">전체</option>
          <option value="Champagne">Champagne</option>
          <option value="Sparkling">Sparkling</option>
          <option value="Red">Red</option>
          <option value="White">White</option>
          <option value="Rosé">Rosé</option>
          <option value="Icewine">Icewine</option>
          <option value="Grappa">Grappa</option>
          <option value="Set">Set</option>
          <option value="POS Material">POS Material</option>
          <option value="자재">자재</option>
          <option value="Port">Port</option>
          <option value="타사제품">타사제품</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>브랜드</label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            value={p.brandInput}
            onChange={(e) => {
              const raw = e.target.value.toUpperCase();
              p.setBrandInput(raw);
              const v = raw.replace(/[^A-Z]/g, "").slice(0, 3);
              const match = v ? p.brandList.find((b) => b.abbr === v) : null;
              p.setBrand(match ? match.abbr : "");
              p.resetResults();
            }}
            onBlur={(e) => {
              const v = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
              p.setBrandInput(v);
            }}
            style={{
              ...inputStyle,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          />
          {p.brandInput && (
            <button
              onClick={() => {
                p.setBrand("");
                p.setBrandInput("");
                p.resetResults();
              }}
              style={{
                padding: "4px 6px",
                borderRadius: 4,
                border: "1px solid var(--border-default)",
                background: "#fff",
                fontSize: 10,
                color: "var(--neutral-100)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              X
            </button>
          )}
        </div>
        {p.brand && (
          <div style={{ fontSize: 10, color: "var(--action)", fontWeight: 600, marginTop: 2 }}>
            {p.brandList.find((b) => b.abbr === p.brand)?.name || p.brand} ({p.brand})
          </div>
        )}
      </div>
    </div>
  );
}
