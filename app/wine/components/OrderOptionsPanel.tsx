"use client";

import { WINE_COLORS } from "../constants";
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
    <div style={{ borderTop: `1px solid ${WINE_COLORS.dividerCard}` }}>
      <button onClick={() => setPanelOpen(!panelOpen)} style={toggleHeaderStyle}>
        <span>발주 옵션</span>
        <span
          style={{
            fontSize: 11,
            color: WINE_COLORS.textMuted,
            transition: "transform 0.2s ease",
            transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          &#9660;
        </span>
      </button>

      {panelOpen && (
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: WINE_COLORS.textMuted,
                display: "block",
                marginBottom: 8,
                letterSpacing: "0.03em",
              }}
            >
              배송일 지정 (선택)
            </label>
            <input
              type="text"
              value={customDeliveryDate}
              onChange={(e) => setCustomDeliveryDate(e.target.value)}
              placeholder="예: 1/10(금), 내일, 1월 10일"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                border: `1.5px solid ${WINE_COLORS.primaryBorder}`,
                fontSize: 16,
                background: WINE_COLORS.surfaceBg,
                marginBottom: 10,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {quickDeliveryDates.map((d, idx) => {
                const isSelected = customDeliveryDate === d.value;
                return (
                  <button
                    key={idx}
                    onClick={() => setCustomDeliveryDate(d.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${
                        isSelected ? WINE_COLORS.primary : WINE_COLORS.primaryBorder
                      }`,
                      background: isSelected
                        ? WINE_COLORS.primaryBgHover
                        : WINE_COLORS.surface,
                      color: isSelected ? WINE_COLORS.primary : WINE_COLORS.textMuted,
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

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
            style={{ color: WINE_COLORS.surface, fontSize: 13, fontWeight: 700, lineHeight: 1 }}
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
      <span style={{ fontSize: 14, color: WINE_COLORS.text }}>{label}</span>
    </label>
  );
}
