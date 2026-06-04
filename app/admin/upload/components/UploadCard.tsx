"use client";

import { useRef } from "react";
import Card from "@/app/components/ui/Card";
import type { UploadAreaDef, UploadCardState, UploadMode } from "../types";
import { ACCEPT } from "../constants";
import { Spinner } from "./Spinner";

type Props = {
  area: UploadAreaDef;
  state: UploadCardState;
  onUpload: (type: string, file: File) => void;
  onDragState: (over: boolean) => void;
  uploadMode?: UploadMode;
  onModeChange?: (mode: UploadMode) => void;
  lastDate?: string | null;
};

export function UploadCard({
  area,
  state,
  onUpload,
  onDragState,
  uploadMode,
  onModeChange,
  lastDate,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragState(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(area.type, file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragState(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragState(false);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(area.type, file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading = state.status === "uploading";
  const isOver = state.isDragOver;
  const borderColor = isOver
    ? "var(--color-primary)"
    : state.status === "success"
      ? "var(--color-success)"
      : state.status === "error"
        ? "var(--color-error)"
        : "var(--color-border)";

  const hasMode = uploadMode !== undefined && onModeChange;

  return (
    <Card
      style={{
        border: `2px dashed ${borderColor}`,
        background: isOver
          ? "rgba(139,21,56,0.04)"
          : state.status === "success"
            ? "rgba(52,199,89,0.04)"
            : state.status === "error"
              ? "rgba(255,59,48,0.04)"
              : "var(--color-card)",
        transition: "all var(--transition-fast)",
        cursor: isUploading ? "not-allowed" : "default",
        opacity: isUploading ? 0.7 : 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {(hasMode || lastDate) && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {lastDate && (
            <div
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "var(--radius-sm)",
                background: "var(--status-info-bg)",
                color: "var(--status-info)",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: hasMode ? "var(--space-2)" : 0,
              }}
            >
              {lastDate}까지 업데이트됨
            </div>
          )}
          {hasMode && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <ModeBtn
                  label="누적 추가"
                  active={uploadMode === "append"}
                  activeColor="var(--status-info)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeChange!("append");
                  }}
                />
                <ModeBtn
                  label="전체 교체"
                  active={uploadMode === "replace"}
                  activeColor="var(--status-danger)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeChange!("replace");
                  }}
                />
              </div>
              {uploadMode === "replace" && (
                <div style={{ marginTop: "var(--space-1)", fontSize: "11px", color: "var(--status-danger)" }}>
                  전체 교체 시 기존 데이터가 삭제됩니다
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div
        onDrop={isUploading ? undefined : handleDrop}
        onDragOver={isUploading ? undefined : handleDragOver}
        onDragLeave={isUploading ? undefined : handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-3)",
          padding: "var(--space-6)",
          minHeight: 200,
          flex: 1,
          cursor: isUploading ? "not-allowed" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-xl)",
            background: "rgba(139,21,56,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {area.icon}
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "var(--space-1)",
            }}
          >
            {area.label}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-light)" }}>
            {area.description}
          </div>
        </div>

        {isUploading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: "var(--space-1)",
            }}
          >
            <Spinner />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-light)" }}>
              업로드 중... {state.fileName}
            </span>
          </div>
        )}
        {state.status === "success" && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--status-success)",
              textAlign: "center",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--status-success-bg)",
              borderRadius: "var(--radius-sm)",
              maxWidth: "100%",
              wordBreak: "break-all",
            }}
          >
            {state.fileName}
            <br />
            {state.message}
          </div>
        )}
        {state.status === "error" && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--status-danger)",
              textAlign: "center",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--status-danger-bg)",
              borderRadius: "var(--radius-sm)",
              maxWidth: "100%",
              wordBreak: "break-all",
            }}
          >
            {state.message}
          </div>
        )}
        {state.status === "idle" && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-lighter)",
              textAlign: "center",
            }}
          >
            파일을 드래그하거나 클릭하여 업로드
            <br />
            <span style={{ fontSize: "11px" }}>(.xlsx, .xls, .csv)</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ModeBtn({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 600,
        transition: "all 0.15s",
        background: active ? activeColor : "var(--color-background)",
        color: active ? "#fff" : "var(--color-text-light)",
      }}
    >
      {label}
    </button>
  );
}
