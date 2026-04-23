"use client";

import type { SaveStatus } from "../types";
import { btnPrimary } from "../styles";

type Props = {
  saveStatus: SaveStatus;
  itemsCount: number;
  onSave: () => void;
};

export function SaveButton({ saveStatus, itemsCount, onSave }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        justifyContent: "center",
        marginTop: 8,
        marginBottom: 24,
      }}
    >
      <button
        onClick={onSave}
        disabled={saveStatus === "saving"}
        style={{
          ...btnPrimary,
          padding: "14px 32px",
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          opacity: saveStatus === "saving" ? 0.6 : 1,
          background: saveStatus === "saved" && itemsCount === 0 ? "#16a34a" : "#5A1515",
        }}
      >
        {saveStatus === "saving" ? (
          <>
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid white",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            저장 중...
          </>
        ) : saveStatus === "saved" && itemsCount === 0 ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            저장됨
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            저장{itemsCount > 0 ? ` (${itemsCount}건 기입)` : ""}
          </>
        )}
      </button>
    </div>
  );
}
