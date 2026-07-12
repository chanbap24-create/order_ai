"use client";

import { PRICE_PRESETS, YEAR_PRESETS, YEARS } from "../constants";
import { inputStyle, labelStyle, selectStyle } from "../styles";

type Props = {
  priceMin: string;
  priceMax: string;
  setPriceMin: (v: string) => void;
  setPriceMax: (v: string) => void;
  setPricePreset: (min: number, max: number) => void;
  startYear: string;
  endYear: string;
  setStartYear: (v: string) => void;
  setEndYear: (v: string) => void;
  setYearPreset: (sy: number, ey: number) => void;
  resetResults: () => void;
};

export function ConditionRanges(p: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <label style={labelStyle}>공급가</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {PRICE_PRESETS.map((ps) => {
            const isActive = p.priceMin === String(ps.min) && p.priceMax === String(ps.max);
            return (
              <button
                key={ps.label}
                onClick={() => p.setPricePreset(ps.min, ps.max)}
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: 4,
                  border: isActive ? "1px solid var(--action)" : "1px solid var(--border-default)",
                  cursor: "pointer",
                  background: isActive ? "var(--action)" : "#fff",
                  color: isActive ? "#fff" : "var(--neutral-200)",
                }}
              >
                {ps.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={p.priceMin}
            onChange={(e) => {
              p.setPriceMin(e.target.value);
              p.resetResults();
            }}
            placeholder="0"
            style={{ ...inputStyle, flex: 1 }}
          />
          <span style={{ color: "var(--gray-300)", fontSize: 12 }}>~</span>
          <input
            type="number"
            value={p.priceMax}
            onChange={(e) => {
              p.setPriceMax(e.target.value);
              p.resetResults();
            }}
            placeholder="999,999"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>기간</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {YEAR_PRESETS.map((ys) => {
            const isActive = p.startYear === String(ys.start) && p.endYear === String(ys.end);
            return (
              <button
                key={ys.label}
                onClick={() => p.setYearPreset(ys.start, ys.end)}
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: 4,
                  border: isActive ? "1px solid var(--action)" : "1px solid var(--border-default)",
                  cursor: "pointer",
                  background: isActive ? "var(--action)" : "#fff",
                  color: isActive ? "#fff" : "var(--neutral-200)",
                }}
              >
                {ys.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={p.startYear}
            onChange={(e) => {
              p.setStartYear(e.target.value);
              p.resetResults();
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <span style={{ color: "var(--gray-300)", fontSize: 12 }}>~</span>
          <select
            value={p.endYear}
            onChange={(e) => {
              p.setEndYear(e.target.value);
              p.resetResults();
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
