"use client";

import type { SelectedRankClient } from "../types";
import { IMPORTANCE_LABELS } from "../constants";

type Props = {
  client: SelectedRankClient;
  importance: number;
  quickSetImportance: (n: number) => void;
  onBack: () => void;
};

export function ClientDetailHeader({ client, importance, quickSetImportance, onBack }: Props) {
  const imp = IMPORTANCE_LABELS[importance] || IMPORTANCE_LABELS[3];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-tertiary)",
            display: "flex",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {client.client_name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: imp.color,
                background: imp.color + "15",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {imp.label}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{client.client_code}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {client.manager && `담당: ${client.manager}`}
            {client.business_type && ` · ${client.business_type}`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const info = IMPORTANCE_LABELS[n];
          const isActive = importance === n;
          return (
            <button
              key={n}
              onClick={() => quickSetImportance(n)}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: `1px solid ${isActive ? info.color : "var(--gray-200)"}`,
                background: isActive ? info.color + "15" : "white",
                color: isActive ? info.color : "#999",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {info.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
