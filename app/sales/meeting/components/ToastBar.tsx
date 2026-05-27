"use client";

import type { ReminderToast } from "../types";

type Props = {
  toast: string;
  pendingCalUrl: string;
  hasReminderToast: boolean;
  onClearPending: () => void;
  reminderToast: ReminderToast | null;
  onReminderClick: () => void;
  onReminderDismiss: () => void;
};

/** 알람 토스트 + 일반 토스트 (캘린더 링크 포함) */
export function ToastBar(p: Props) {
  return (
    <>
      {p.reminderToast && (
        <div
          onClick={p.onReminderClick}
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--action)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 2100,
            boxShadow: "0 4px 16px rgba(90,21,21,0.3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "calc(100% - 32px)",
          }}
        >
          <span style={{ flex: 1 }}>{p.reminderToast.text}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.onReminderDismiss();
            }}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 18,
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {p.toast && (
        <div
          style={{
            position: "fixed",
            top: p.hasReminderToast ? 130 : 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: p.toast.startsWith("오류") ? "#c53030" : "#38a169",
            color: "#fff",
            padding: p.pendingCalUrl ? "10px 16px" : "12px 24px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 2000,
            boxShadow: "0 4px 12px rgba(90,21,21,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "90vw",
          }}
        >
          <span>{p.toast}</span>
          {p.pendingCalUrl && (
            <a
              href={p.pendingCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={p.onClearPending}
              style={{
                background: "#fff",
                color: "#4285F4",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              📅 캘린더 추가
            </a>
          )}
        </div>
      )}
    </>
  );
}
