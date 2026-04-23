"use client";

import { useCallback, useRef, useState } from "react";
import Card from "@/app/components/ui/Card";
import type { BatchFile, DetectedType, UploadMode } from "../types";
import { ACCEPT, BATCH_TYPE_OPTIONS } from "../constants";
import { detectFileType } from "../lib/detectType";
import { Spinner } from "./Spinner";
import { BatchFileRow } from "./BatchFileRow";

type Props = {
  handleUpload: (type: string, file: File, mode?: UploadMode) => Promise<void>;
  checkStatus: () => void;
};

export function SmartBatchUpload({ handleUpload, checkStatus }: Props) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyzeFiles = useCallback(async (fileList: FileList | File[]) => {
    setIsAnalyzing(true);
    const newFiles: BatchFile[] = [];
    for (const file of Array.from(fileList)) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) continue;
      const { type, confidence, reason } = await detectFileType(file);
      newFiles.push({ file, detectedType: type, confidence, reason, status: "pending" });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setIsAnalyzing(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) analyzeFiles(e.dataTransfer.files);
    },
    [analyzeFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) analyzeFiles(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [analyzeFiles],
  );

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearAll = () => setFiles([]);

  const setOverride = (idx: number, type: DetectedType) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, overrideType: type === f.detectedType ? undefined : type } : f,
      ),
    );
  };

  const getEffectiveType = (f: BatchFile): DetectedType => f.overrideType || f.detectedType;

  const batchUpload = async () => {
    const uploadable = files.filter(
      (f) => getEffectiveType(f) !== "unknown" && f.status !== "success",
    );
    if (uploadable.length === 0) return;

    const typeCount = new Map<string, number>();
    for (const f of uploadable) {
      const t = getEffectiveType(f);
      typeCount.set(t, (typeCount.get(t) || 0) + 1);
    }
    const dupes = Array.from(typeCount.entries()).filter(([, c]) => c > 1);
    if (dupes.length > 0) {
      const names = dupes
        .map(([t]) => BATCH_TYPE_OPTIONS.find((o) => o.value === t)?.label || t)
        .join(", ");
      if (!confirm(`${names}에 여러 파일이 지정되어 있습니다. 계속하시겠습니까?`)) return;
    }

    setIsBatchUploading(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const effectiveType = getEffectiveType(f);
      if (effectiveType === "unknown" || f.status === "success") continue;

      setFiles((prev) =>
        prev.map((pf, pi) =>
          pi === i ? { ...pf, status: "uploading", message: "업로드 중..." } : pf,
        ),
      );

      try {
        await handleUpload(effectiveType, f.file);
        setFiles((prev) =>
          prev.map((pf, pi) => (pi === i ? { ...pf, status: "success", message: "완료" } : pf)),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((pf, pi) =>
            pi === i
              ? { ...pf, status: "error", message: err instanceof Error ? err.message : "오류" }
              : pf,
          ),
        );
      }
    }

    setIsBatchUploading(false);
    checkStatus();
  };

  const uploadableCount = files.filter(
    (f) => getEffectiveType(f) !== "unknown" && f.status !== "success",
  ).length;

  return (
    <Card style={{ marginBottom: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>스마트 일괄 업로드</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-light)", marginTop: 2 }}>
            여러 파일을 한번에 드래그하면 자동으로 파일 종류를 감지합니다
          </p>
        </div>
        {files.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={clearAll} disabled={isBatchUploading}>
            전체 초기화
          </button>
        )}
      </div>

      <div
        ref={dropRef}
        onDrop={isBatchUploading ? undefined : handleDrop}
        onDragOver={
          isBatchUploading
            ? undefined
            : (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
              }
        }
        onDragLeave={
          isBatchUploading
            ? undefined
            : (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
              }
        }
        onClick={() => !isBatchUploading && !isAnalyzing && inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragOver ? "var(--color-primary)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: isBatchUploading ? "not-allowed" : "pointer",
          background: isDragOver ? "rgba(139,21,56,0.04)" : "var(--color-background)",
          transition: "all 0.15s",
          marginBottom: files.length > 0 ? "var(--space-4)" : 0,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={handleFileInput}
          disabled={isBatchUploading}
        />
        {isAnalyzing ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Spinner />
            <span style={{ color: "var(--color-text-light)", fontSize: "var(--text-sm)" }}>
              파일 분석 중...
            </span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📂</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-light)" }}>
              6개 파일을 한번에 드래그하거나 클릭하여 선택
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-lighter)",
                marginTop: 4,
              }}
            >
              재고(CDV/DL) + 출고현황(CDV/DL) + 수금(Wine/DL) 자동 감지
            </div>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {files.map((f, idx) => (
            <BatchFileRow
              key={idx}
              f={f}
              effectiveType={getEffectiveType(f)}
              onOverride={(type) => setOverride(idx, type)}
              onRemove={() => removeFile(idx)}
            />
          ))}

          {uploadableCount > 0 && (
            <button
              className="btn btn-primary"
              onClick={batchUpload}
              disabled={isBatchUploading}
              style={{ marginTop: "var(--space-2)", width: "100%", padding: "var(--space-3)" }}
            >
              {isBatchUploading ? "업로드 중..." : `${uploadableCount}개 파일 일괄 업로드`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
