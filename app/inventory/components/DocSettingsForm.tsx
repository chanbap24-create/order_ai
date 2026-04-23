"use client";

import type { DocSettings } from "../types";

type Props = {
  docSettings: DocSettings;
  setDocSettings: (updater: (prev: DocSettings) => DocSettings) => void;
  onResetDefaults: () => void;
};

const FIELDS: [keyof DocSettings, string][] = [
  ["companyName", "회사명"],
  ["address", "주소/연락처"],
  ["addressEn", "영문주소"],
  ["websiteUrl", "웹사이트/SNS"],
  ["sender", "발신"],
  ["title", "제목"],
  ["content1", "내용 1"],
  ["content2", "내용 2"],
  ["content3", "내용 3"],
  ["unit", "단위"],
  ["representative", "대표자"],
  ["sealText", "직인"],
];

/** 견적 문서 설정 폼 (회사명/주소/내용 등 12필드 + 기본값 초기화) */
export function DocSettingsForm({ docSettings, setDocSettings, onResetDefaults }: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 14,
        background: "#fafaf8",
        borderRadius: 8,
        border: "1px solid #F0EFED",
      }}
    >
      <div
        style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 10, color: "#2D2D2D" }}
      >
        문서 설정
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FIELDS.map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#555",
                minWidth: 72,
                flexShrink: 0,
              }}
            >
              {label}
            </label>
            <input
              type="text"
              value={String(docSettings[key] ?? "")}
              onChange={(e) => setDocSettings((prev) => ({ ...prev, [key]: e.target.value }))}
              style={{
                flex: 1,
                fontSize: 16,
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid #E5E5E5",
                minWidth: 0,
                outline: "none",
              }}
            />
          </div>
        ))}
      </div>
      <button
        onClick={onResetDefaults}
        style={{
          marginTop: 8,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid #E5E5E5",
          background: "white",
          fontSize: "0.72rem",
          cursor: "pointer",
          color: "#666",
        }}
      >
        기본값 초기화
      </button>
    </div>
  );
}
