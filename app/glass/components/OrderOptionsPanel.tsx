"use client";

import { GLASS_COLORS } from "../constants";
import type { QuickDeliveryDate } from "../lib/deliveryDates";
import { checkboxSquareStyle, toggleHeaderStyle } from "./styles";

export type OrderOptionsPanelProps = {
  customDeliveryDate: string;
  setCustomDeliveryDate: (v: string) => void;
  requirePaymentConfirm: boolean;
  setRequirePaymentConfirm: (v: boolean) => void;
  requireInvoice: boolean;
  setRequireInvoice: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  quickDeliveryDates: QuickDeliveryDate[];
};

/**
 * 발주 옵션 접기/펼치기 패널 — 배송일 지정 + 옵션 체크박스 2개.
 */
export function OrderOptionsPanel({
  customDeliveryDate,
  setCustomDeliveryDate,
  requirePaymentConfirm,
  setRequirePaymentConfirm,
  requireInvoice,
  setRequireInvoice,
  panelOpen,
  setPanelOpen,
  quickDeliveryDates,
}: OrderOptionsPanelProps) {
  return (
    <div style={{ borderTop: `1px solid ${GLASS_COLORS.dividerCard}` }}>
      <button onClick={() => setPanelOpen(!panelOpen)} style={toggleHeaderStyle}>
        <span>발주 옵션</span>
        <span
          style={{
            fontSize: 11,
            color: GLASS_COLORS.textMuted,
            transition: "transform 0.2s ease",
            transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
      </button>

      {panelOpen && (
        <div style={{ padding: "0 18px 18px" }}>
          <DeliveryDatePicker
            value={customDeliveryDate}
            setValue={setCustomDeliveryDate}
            quickDates={quickDeliveryDates}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Checkbox
              label="입금확인후 출고"
              checked={requirePaymentConfirm}
              onChange={setRequirePaymentConfirm}
            />
            <Checkbox
              label="거래명세표 부탁드립니다"
              checked={requireInvoice}
              onChange={setRequireInvoice}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryDatePicker({
  value,
  setValue,
  quickDates,
}: {
  value: string;
  setValue: (v: string) => void;
  quickDates: QuickDeliveryDate[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: GLASS_COLORS.textMuted,
          display: "block",
          marginBottom: 8,
          letterSpacing: "0.03em",
        }}
      >
        배송일 지정 (선택)
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="예: 1/10(금), 내일, 1월 10일"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: `1.5px solid ${GLASS_COLORS.primaryBorder}`,
          fontSize: 16,
          background: GLASS_COLORS.surfaceBg,
          marginBottom: 10,
          outline: "none",
        }}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {quickDates.map((d, idx) => {
          const isSelected = value === d.value;
          return (
            <button
              key={idx}
              onClick={() => setValue(d.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1.5px solid ${
                  isSelected ? GLASS_COLORS.primary : GLASS_COLORS.primaryBorder
                }`,
                background: isSelected ? GLASS_COLORS.primaryBgHover : GLASS_COLORS.surface,
                color: isSelected ? GLASS_COLORS.primary : GLASS_COLORS.textMuted,
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div style={checkboxSquareStyle(checked)}>
        {checked && (
          <span
            style={{ color: GLASS_COLORS.surface, fontSize: 13, fontWeight: 700, lineHeight: 1 }}
          >
            &#10003;
          </span>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: "none" }}
      />
      <span style={{ fontSize: 14, color: GLASS_COLORS.text }}>{label}</span>
    </label>
  );
}
