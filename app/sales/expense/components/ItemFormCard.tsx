"use client";

import type { useItemForm } from "../hooks/useItemForm";
import { ACCOUNT_CATEGORIES } from "../constants";
import { btnPrimary, cardStyle, inputStyle, labelStyle } from "../styles";

type Props = {
  form: ReturnType<typeof useItemForm>;
};

export function ItemFormCard({ form }: Props) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#2c1810", marginBottom: 14 }}>
        {form.parseResult ? "파싱 결과 확인" : "직접 입력"}
        {form.parseResult && form.parseResult.confidence >= 0.8 && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#16a34a", marginLeft: 8 }}>
            신뢰도 {Math.round(form.parseResult.confidence * 100)}%
          </span>
        )}
        {form.parseResult && form.parseResult.confidence < 0.8 && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#E65100", marginLeft: 8 }}>
            신뢰도 {Math.round(form.parseResult.confidence * 100)}% — 확인 필요
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>사용일자</label>
          <input
            type="date"
            value={form.editDate}
            onChange={(e) => form.setEditDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>계정과목</label>
          <select
            value={form.editCategory}
            onChange={(e) => form.setEditCategory(e.target.value)}
            style={{ ...inputStyle, color: "#2c1810" }}
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>사용내역</label>
          <input
            type="text"
            value={form.editDesc}
            onChange={(e) => form.setEditDesc(e.target.value)}
            placeholder="상호명 / 내용"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>금액</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.editAmount}
            onChange={(e) => form.setEditAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            style={{ ...inputStyle, textAlign: "right" }}
          />
          {form.editAmount && (
            <div
              style={{
                fontSize: 11,
                color: "#8a8580",
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {Number(form.editAmount).toLocaleString()}원
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>비고</label>
          <input
            type="text"
            value={form.editNote}
            onChange={(e) => form.setEditNote(e.target.value)}
            placeholder="선택사항"
            style={inputStyle}
          />
        </div>
        {form.editCategory === "차량유지비" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>운행거리 (KM)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.editKm}
              onChange={(e) => form.setEditKm(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              style={{ ...inputStyle, textAlign: "right" }}
            />
            {form.editKm && (
              <div
                style={{
                  fontSize: 11,
                  color: "#8a8580",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                {Number(form.editKm).toLocaleString()}km
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button onClick={form.addItem} style={btnPrimary}>
          항목 추가
        </button>
        <button
          onClick={form.startManualEntry}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "1.5px solid rgba(90,21,21,0.1)",
            background: "transparent",
            fontSize: 14,
            fontWeight: 600,
            color: "#5A1515",
            cursor: "pointer",
          }}
        >
          직접 입력
        </button>
      </div>
    </div>
  );
}
