"use client";

import { useRef } from "react";
import type { SaveStatus } from "../types";
import { cardStyle } from "../styles";

type Props = {
  saveStatus: SaveStatus;
  hasWorkbook: boolean;
  excelLoading: boolean;
  sheetNames: string[];
  selectedSheet: string;
  setSelectedSheet: (s: string) => void;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenPreview: () => void;
  onDownload: () => void;
};

export function ExcelUploadCard(p: Props) {
  const excelInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#2c1810",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A1515" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        법인카드 엑셀
        {p.saveStatus === "saved" && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#16a34a", marginLeft: "auto" }}>
            저장됨
          </span>
        )}
        {p.saveStatus === "unsaved" && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#E65100", marginLeft: "auto" }}>
            미저장
          </span>
        )}
      </div>

      {!p.hasWorkbook ? (
        <div
          onClick={() => excelInputRef.current?.click()}
          style={{
            border: "2px dashed rgba(90,21,21,0.15)",
            borderRadius: 12,
            padding: "32px 16px",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.2s ease, background 0.2s ease",
            background: "rgba(90,21,21,0.01)",
          }}
        >
          {p.excelLoading ? (
            <div style={{ color: "#8a8580", fontSize: 13 }}>엑셀 로딩 중...</div>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8a8580" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#5A1515", marginBottom: 4 }}>
                법인카드 엑셀 파일 업로드
              </div>
              <div style={{ fontSize: 12, color: "#8a8580" }}>
                클릭하여 .xlsx 파일을 선택하세요
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={p.selectedSheet}
            onChange={(e) => p.setSelectedSheet(e.target.value)}
            style={{
              padding: "8px 32px 8px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: "1.5px solid rgba(90,21,21,0.12)",
              background: "#faf9f7",
              color: "#5A1515",
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              minWidth: 100,
            }}
          >
            {p.sheetNames.map((name) => {
              const m = name.match(/(\d{4})(\d{2})/);
              const label = m ? `${m[1]}년 ${Number(m[2])}월` : name;
              return (
                <option key={name} value={name}>
                  {label}
                </option>
              );
            })}
          </select>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <IconBtn onClick={p.onOpenPreview} label="현황" />
            <IconBtn onClick={p.onDownload} label="다운로드" />
            <IconBtn onClick={() => excelInputRef.current?.click()} label="" title="파일 교체" />
          </div>
        </div>
      )}

      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={p.onExcelUpload}
        style={{ display: "none" }}
      />
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  title,
}: {
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: label ? "8px 12px" : "8px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        border: "1.5px solid rgba(90,21,21,0.1)",
        background: "#faf9f7",
        color: label ? "#5A1515" : "#8a8580",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {label}
    </button>
  );
}
