"use client";

import type { DeliveryDateInfo, FridayChoice } from "../types";

type Props = {
  open: boolean;
  toggleOpen: () => void;
  info: DeliveryDateInfo;
  fridayChoice: FridayChoice;
  setFridayChoice: (v: FridayChoice) => void;
  customDate: string;
  setCustomDate: (v: string) => void;
  finalLabel: string;
};

/** 배송 예정일 선택 UI (금요일 토/월 분기 + 임의 날짜) */
export function DeliveryDatePanel({
  open,
  toggleOpen,
  info,
  fridayChoice,
  setFridayChoice,
  customDate,
  setCustomDate,
  finalLabel,
}: Props) {
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
        <Chevron open={open} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
          배송 예정일
        </span>
        {finalLabel && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              marginLeft: 4,
            }}
          >
            {finalLabel}
          </span>
        )}
      </button>
      {open && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          {info.options ? (
            <>
              <ChoiceButton
                active={fridayChoice === "saturday" && !customDate}
                onClick={() => {
                  setFridayChoice("saturday");
                  setCustomDate("");
                }}
              >
                토 {info.options.sat.getMonth() + 1}/{info.options.sat.getDate()}
              </ChoiceButton>
              <ChoiceButton
                active={fridayChoice === "monday" && !customDate}
                onClick={() => {
                  setFridayChoice("monday");
                  setCustomDate("");
                }}
              >
                월 {info.options.mon.getMonth() + 1}/{info.options.mon.getDate()}
              </ChoiceButton>
            </>
          ) : (
            <ChoiceButton active={!customDate} onClick={() => setCustomDate("")}>
              {info.label}
            </ChoiceButton>
          )}
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            style={{
              fontSize: 16,
              padding: "5px 10px",
              borderRadius: 8,
              border: customDate
                ? "1.5px solid rgba(255,255,255,0.6)"
                : "1px solid rgba(255,255,255,0.2)",
              background: customDate ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
              colorScheme: "dark",
            }}
          />
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
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
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        border: active ? "1.5px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.2)",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: "#fff",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}
