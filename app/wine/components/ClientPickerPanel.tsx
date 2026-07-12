"use client";

import { WINE_COLORS } from "../constants";
import { monoStyle } from "./styles";

type Props = {
  candidates: any[];
  loading: boolean;
  hintUsed: string;
  pendingOrderText: string;
  onPick: (c: any) => void;
};

/** 거래처 후보 동점/애매 선택 패널 */
export function ClientPickerPanel({
  candidates,
  loading,
  hintUsed,
  pendingOrderText,
  onPick,
}: Props) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          background: WINE_COLORS.surface,
          borderRadius: 12,
          border: `1px solid ${WINE_COLORS.dividerCard}`,
          boxShadow: WINE_COLORS.primaryShadowSubtle,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px 12px",
            borderBottom: `1px solid ${WINE_COLORS.dividerCard}`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: WINE_COLORS.text }}>
            거래처 선택이 필요합니다
          </div>
          <div
            style={{
              color: WINE_COLORS.textMuted,
              fontSize: 12,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            입력된 거래처가 여러 후보로 매칭되었습니다. 아래에서 선택하세요.
          </div>
        </div>

        <div
          style={{
            padding: "12px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {candidates.map((c, idx) => (
            <button
              key={`${c.client_code}-${idx}`}
              onClick={() => onPick(c)}
              disabled={loading}
              style={{
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: 12,
                border: `1.5px solid ${WINE_COLORS.primaryBorder}`,
                cursor: loading ? "not-allowed" : "pointer",
                background: WINE_COLORS.surfaceBg,
              }}
            >
              <div style={{ fontWeight: 700, color: WINE_COLORS.text }}>{c.client_name}</div>
              <div style={{ fontSize: 12, color: WINE_COLORS.textMuted, marginTop: 4 }}>
                코드: {c.client_code} · 점수: {c.score}
              </div>
            </button>
          ))}

          {candidates.length === 0 && (
            <div style={{ color: WINE_COLORS.textMuted, fontSize: 12, padding: 8 }}>
              후보가 비어 있습니다.
            </div>
          )}

          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
            힌트: <b>{hintUsed}</b>
            {pendingOrderText ? (
              <>
                <br />
                주문 라인: <span style={monoStyle}>{pendingOrderText}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
