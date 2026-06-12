"use client";

import { useEffect, useRef, useState } from "react";
import { ORDER_COLORS } from "../constants";
import { imageFilesFrom } from "../lib/imageFile";

type Props = {
  loading: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onClearError: () => void;
};

/** 카톡 스크린샷 인테이크: 클릭 선택 / 드래그앤드롭 / 붙여넣기. 여러 장이면 배치. */
export function ImageIntakeButton({ loading, error, onFiles, onClearError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (files: File[]) => {
    if (files.length === 0) return;
    onClearError();
    onFiles(files);
  };

  // 클립보드 이미지 붙여넣기 (PC). 텍스트 붙여넣기는 textarea가 처리하므로 이미지만.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFilesFrom(
        Array.from(e.clipboardData?.items || [])
          .filter((it) => it.kind === "file")
          .map((it) => it.getAsFile())
          .filter((f): f is File => !!f),
      );
      if (files.length > 0) {
        e.preventDefault();
        emit(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFiles]);

  return (
    <div style={{ marginBottom: 14 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          emit(imageFilesFrom(e.target.files));
          e.target.value = "";
        }}
      />
      <div
        onClick={() => { if (!loading) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          emit(imageFilesFrom(e.dataTransfer?.files));
        }}
        style={{
          padding: "16px 14px",
          borderRadius: 10,
          border: `1.5px dashed ${dragging ? ORDER_COLORS.primary : ORDER_COLORS.confHigh}`,
          background: dragging ? "rgba(90,21,21,0.05)" : loading ? "#f3efe9" : "rgba(120,160,90,0.06)",
          color: loading ? ORDER_COLORS.textMuted : ORDER_COLORS.text,
          fontSize: 15,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          textAlign: "center",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading ? "📷 분석 중…" : dragging ? "여기에 놓으세요" : "📷 카톡 스샷 불러오기"}
        </div>
        <div style={{ fontSize: 11, color: ORDER_COLORS.textMuted, marginTop: 4, fontWeight: 500 }}>
          클릭·드래그·붙여넣기 · 여러 장이면 자동 배치 처리
        </div>
      </div>
      {error && (
        <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: 8, background: "rgba(180,50,50,0.07)", color: ORDER_COLORS.confLow, fontSize: 13, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </div>
  );
}
