"use client";

import { useRef } from "react";
import type { TastingWineRow } from "../types";
import { noteBadge, verificationBadge } from "../constants";

type Props = {
  wines: TastingWineRow[];
  loading: boolean;
  ghIndex: Record<string, boolean>;
  selectedId: string | null;
  checkedIds: Set<string>;
  onSelect: (wine: TastingWineRow) => void;
  toggleCheck: (id: string) => void;
  toggleAllChecks: () => void;
  uploadingFileId: string | null;
  onUploadFile: (itemCode: string, file: File) => void;
};

export function NoteListPanel(p: Props) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        width: 340,
        minWidth: 300,
        overflowY: "auto",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--gray-200)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "2px solid var(--gray-200)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 0,
          background: "#f9fafb",
          zIndex: 1,
        }}
      >
        <input
          type="checkbox"
          checked={p.wines.length > 0 && p.checkedIds.size === p.wines.length}
          onChange={p.toggleAllChecks}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        <span style={{ fontSize: 12, color: "var(--gray-500)", fontWeight: 600 }}>
          전체선택 ({p.wines.length})
        </span>
      </div>

      {p.loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>로딩 중...</div>
      ) : p.wines.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--gray-400)", fontSize: 13 }}>
          해당하는 와인이 없습니다.
        </div>
      ) : (
        p.wines.map((w) => {
          const badge = noteBadge(w, p.ghIndex);
          const isSelected = p.selectedId === w.item_code;
          const totalStock = (w.inv_available || 0) + (w.inv_bonded || 0);
          const vb = verificationBadge(w.verification_status);

          return (
            <div
              key={w.item_code}
              onClick={() => p.onSelect(w)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid var(--gray-100)",
                cursor: "pointer",
                background: isSelected ? "#eff6ff" : "#fff",
                borderLeft: isSelected ? "3px solid var(--status-info)" : "3px solid transparent",
              }}
            >
              <input
                type="checkbox"
                checked={p.checkedIds.has(w.item_code)}
                onChange={(e) => {
                  e.stopPropagation();
                  p.toggleCheck(w.item_code);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <span style={{ fontSize: 14 }}>{badge.icon}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {w.item_name_kr}
                </div>
                <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>
                  {w.item_code} {w.item_name_en ? `· ${w.item_name_en}` : ""}
                </div>
                <div style={{ fontSize: 10, color: "var(--gray-500)", marginTop: 2, display: "flex", gap: 6 }}>
                  <span>
                    재고{" "}
                    <b style={{ color: (w.inv_available || 0) > 0 ? "var(--status-success)" : "var(--gray-300)" }}>
                      {w.inv_available ?? 0}
                    </b>
                  </span>
                  <span>
                    보세{" "}
                    <b style={{ color: (w.inv_bonded || 0) > 0 ? "#0ea5e9" : "var(--gray-300)" }}>
                      {w.inv_bonded ?? 0}
                    </b>
                  </span>
                  <span>
                    합계 <b style={{ color: totalStock > 0 ? "#1e293b" : "var(--gray-300)" }}>{totalStock}</b>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                {vb && (
                  <span
                    title={vb.title}
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 8,
                      background: vb.bg,
                      color: vb.color,
                      fontWeight: 700,
                      lineHeight: "16px",
                    }}
                  >
                    {vb.label}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: badge.bg,
                    color: badge.color,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge.label}
                </span>
                <UploadButton
                  itemCode={w.item_code}
                  uploading={p.uploadingFileId === w.item_code}
                  disabled={p.uploadingFileId !== null && p.uploadingFileId !== w.item_code}
                  onUpload={p.onUploadFile}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * 행별 파일 업로드 버튼.
 * PDF/PPTX 만 accept, 클릭은 행 onSelect 로 전파되지 않게 stopPropagation.
 * 업로드 중에는 ⏳, 평소엔 📤. 동시 업로드 1건 제한.
 */
function UploadButton({
  itemCode,
  uploading,
  disabled,
  onUpload,
}: {
  itemCode: string;
  uploading: boolean;
  disabled: boolean;
  onUpload: (itemCode: string, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      title="PDF/PPTX 파일을 업로드 (파일명은 자동으로 품목코드로 변경)"
      disabled={uploading || disabled}
      onClick={(e) => {
        e.stopPropagation();
        inputRef.current?.click();
      }}
      style={{
        fontSize: 11,
        padding: "2px 6px",
        borderRadius: 4,
        background: uploading ? "#fef3c7" : "var(--gray-100)",
        color: uploading ? "var(--status-warning)" : "var(--gray-500)",
        border: "1px solid var(--gray-300)",
        cursor: uploading ? "wait" : disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1,
      }}
    >
      {uploading ? "⏳" : "📤"}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(itemCode, file);
        }}
      />
    </button>
  );
}
