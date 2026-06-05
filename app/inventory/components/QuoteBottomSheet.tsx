"use client";

import type { QuoteItem } from "../types";
import { formatWon } from "../lib/format";
import { labelStyle, sheetInputStyle } from "./sharedStyles";

type SheetValues = {
  quantity: string;
  discount_rate: string;
  discounted_price: string;
  note: string;
  tasting_note: string;
};

type Props = {
  item: QuoteItem;
  values: SheetValues;
  setValues: (updater: (v: SheetValues) => SheetValues) => void;
  onClose: () => void;
  onSave: () => void;
};

/** 모바일 바텀시트 — 견적 항목 편집 (수량/할인율/할인가/비고/테이스팅노트) */
export function QuoteBottomSheet({ item, values, setValues, onClose, onSave }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          background: "white",
          borderRadius: "12px 12px 0 0",
          padding: "20px 16px",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--gray-300)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
        />
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, paddingRight: 20 }}>
          {item.product_name}
        </h3>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
          {item.item_code}
          {item.vintage && ` · ${item.vintage}`}
          {item.country && ` · ${item.country}`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>수량</label>
            <input
              type="number"
              value={values.quantity}
              onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))}
              style={sheetInputStyle}
              min={0}
            />
          </div>
          <div>
            <label style={labelStyle}>할인율 (%)</label>
            <input
              type="number"
              value={values.discount_rate}
              onChange={(e) => {
                const rate = parseInt(e.target.value) || 0;
                const dp = Math.round(item.supply_price * (1 - rate / 100));
                setValues((v) => ({
                  ...v,
                  discount_rate: e.target.value,
                  discounted_price: String(dp),
                }));
              }}
              style={sheetInputStyle}
              min={0}
              max={100}
            />
          </div>
          <div>
            <label style={labelStyle}>할인가 (원)</label>
            <input
              type="number"
              value={values.discounted_price}
              onChange={(e) => {
                const dp = parseInt(e.target.value) || 0;
                const rate =
                  item.supply_price > 0
                    ? Math.round(((item.supply_price - dp) / item.supply_price) * 100)
                    : 0;
                setValues((v) => ({
                  ...v,
                  discounted_price: e.target.value,
                  discount_rate: String(rate),
                }));
              }}
              style={sheetInputStyle}
              min={0}
            />
          </div>
          <div>
            <label style={labelStyle}>비고</label>
            <textarea
              value={values.note}
              onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
              style={{ ...sheetInputStyle, minHeight: 60, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={labelStyle}>테이스팅노트</label>
            <textarea
              value={values.tasting_note}
              onChange={(e) => setValues((v) => ({ ...v, tasting_note: e.target.value }))}
              style={{ ...sheetInputStyle, minHeight: 60, resize: "vertical" }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "var(--gray-50)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#666" }}>공급가</span>
            <span>{formatWon(item.supply_price)}원</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#666" }}>할인가</span>
            <span>{formatWon(parseInt(values.discounted_price) || 0)}원</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              color: "var(--action)",
            }}
          >
            <span>할인합계</span>
            <span>
              {formatWon(
                (parseInt(values.discounted_price) || 0) * (parseInt(values.quantity) || 0),
              )}
              원
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: "1px solid var(--gray-200)",
              background: "white",
              color: "#666",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={onSave}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: "none",
              background: "var(--action)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export type { SheetValues };
