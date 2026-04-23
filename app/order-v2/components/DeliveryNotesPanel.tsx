"use client";

import { DELIVERY_PRESETS, ORDER_FONT } from "../constants";

type Props = {
  open: boolean;
  toggleOpen: () => void;
  notes: string;
  setNotes: (v: string | ((p: string) => string)) => void;
};

/** 배송 특이사항 프리셋 + 자유 입력 */
export function DeliveryNotesPanel({ open, toggleOpen, notes, setNotes }: Props) {
  const firstLine = notes.trim().split("\n")[0];

  return (
    <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <button
        onClick={toggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.35)",
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▶
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
          특이사항
        </span>
        {firstLine && (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              marginLeft: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 180,
            }}
          >
            {firstLine}
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {DELIVERY_PRESETS.map((preset) => {
              const isActive = notes.includes(preset);
              return (
                <button
                  key={preset}
                  onClick={() => {
                    if (isActive) {
                      setNotes((prev: string) =>
                        prev.replace(preset, "").replace(/\n{2,}/g, "\n").trim(),
                      );
                    } else {
                      setNotes((prev: string) => (prev ? prev + "\n" + preset : preset));
                    }
                  }}
                  className="order-preset-btn"
                  style={{
                    padding: "5px 11px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.5)"
                      : "1px solid rgba(255,255,255,0.15)",
                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="추가 특이사항 입력"
            rows={2}
            style={{
              width: "100%",
              fontSize: 16,
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: ORDER_FONT.base,
            }}
          />
        </div>
      )}
    </div>
  );
}
