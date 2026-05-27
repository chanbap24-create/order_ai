"use client";

import { useRef } from "react";
import type { SaveStatus } from "../types";
import { Section } from "@/app/components/ui";
import { selectStyle, btnSecondary } from "@/app/styles/controls";

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

/**
 * 경비 — 법인카드 엑셀 업로드 카드.
 * - 워크북 없을 때: 드롭존
 * - 워크북 있을 때: 한 줄 (시트 select + 액션 버튼들 + 상태 라벨)
 */
export function ExcelUploadCard(p: Props) {
  const excelInputRef = useRef<HTMLInputElement>(null);

  // 워크북 없으면 드롭존 표시
  if (!p.hasWorkbook) {
    return (
      <Section padding="md">
        <CardTitle saveStatus={p.saveStatus} />
        <div
          onClick={() => excelInputRef.current?.click()}
          style={{
            border: "1.5px dashed var(--border-strong)",
            borderRadius: 10,
            padding: "32px 16px",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.15s ease, background 0.15s ease",
            background: "var(--surface-muted)",
            marginTop: 12,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLDivElement).style.background = "var(--surface-muted)")
          }
        >
          {p.excelLoading ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>엑셀 로딩 중...</div>
          ) : (
            <>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-tertiary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 8 }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--action)", marginBottom: 4 }}>
                법인카드 엑셀 파일 업로드
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                클릭하여 .xlsx 파일을 선택하세요
              </div>
            </>
          )}
        </div>
        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={p.onExcelUpload}
          style={{ display: "none" }}
        />
      </Section>
    );
  }

  // 워크북 있을 때: 컴팩트 한 줄
  return (
    <Section padding="sm">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <FileIcon />

        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          법인카드 엑셀
        </span>

        <select
          value={p.selectedSheet}
          onChange={(e) => p.setSelectedSheet(e.target.value)}
          style={{ ...selectStyle, width: 140 }}
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

        <SaveStatusPill saveStatus={p.saveStatus} />

        <div style={{ flex: 1 }} />

        <button onClick={p.onOpenPreview} style={btnSecondary}>
          현황
        </button>
        <button onClick={p.onDownload} style={btnSecondary}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          다운로드
        </button>
        <button
          onClick={() => excelInputRef.current?.click()}
          style={{ ...btnSecondary, padding: "0 10px" }}
          title="파일 교체"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={p.onExcelUpload}
        style={{ display: "none" }}
      />
    </Section>
  );
}

function CardTitle({ saveStatus }: { saveStatus: SaveStatus }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <FileIcon />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "0.01em",
        }}
      >
        법인카드 엑셀
      </span>
      <div style={{ flex: 1 }} />
      <SaveStatusPill saveStatus={saveStatus} />
    </div>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--action)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function SaveStatusPill({ saveStatus }: { saveStatus: SaveStatus }) {
  if (saveStatus !== "saved" && saveStatus !== "unsaved") return null;
  const isSaved = saveStatus === "saved";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        background: isSaved ? "#dcfce7" : "#fef3c7",
        color: isSaved ? "#15803d" : "#92400e",
        letterSpacing: "0.04em",
      }}
    >
      {isSaved ? "저장됨" : "미저장"}
    </span>
  );
}
