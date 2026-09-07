"use client";

import { useRef, useState } from "react";
import type { Wine } from "@/app/types/wine";

type Props = {
  wine: Wine;
  imageUrlInput: string;
  setImageUrlInput: (s: string) => void;
  imageUrlExpanded: boolean;
  setImageUrlExpanded: (b: boolean) => void;
  savingImageUrl: boolean;
  regeneratingNote?: boolean;
  onSave: (url: string | null) => Promise<void>;
};

export function ImageSection(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  // 파일 선택 → Storage 업로드 → 기존 저장 흐름(onSave)으로 URL 반영 (노트 재생성 포함)
  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/admin/wines/image-upload?item_code=${encodeURIComponent(p.wine.item_code)}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok || !j.image_url) throw new Error(j.error || "업로드 실패");
      await p.onSave(j.image_url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "업로드 실패");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const busy = p.savingImageUrl || uploading;
  const uploadBtn = (
    <button
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid var(--gray-300)",
        background: "#f9fafb",
        fontSize: 12,
        cursor: busy ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {uploading ? "업로드 중..." : "📁 파일 업로드"}
    </button>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadFile(f);
        }}
      />
      {p.wine.image_url && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img
            src={p.wine.image_url}
            alt={p.wine.item_name_kr}
            style={{ maxHeight: 200, borderRadius: 8, border: "1px solid var(--border-default)" }}
          />
        </div>
      )}
      {p.wine.image_url && !p.imageUrlExpanded ? (
        <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => p.setImageUrlExpanded(true)}
            style={{
              fontSize: 12,
              color: "var(--gray-400)",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            이미지 URL 변경
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              fontSize: 12,
              color: "var(--gray-400)",
              background: "none",
              border: "none",
              cursor: busy ? "default" : "pointer",
              textDecoration: "underline",
            }}
          >
            {uploading ? "업로드 중..." : "파일로 교체"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{
              flex: 1,
              minWidth: 160,
              padding: "6px 10px",
              border: "1px solid var(--gray-300)",
              borderRadius: 6,
              fontSize: 16,
            }}
            placeholder="이미지 URL 입력..."
            value={p.imageUrlInput}
            onChange={(e) => p.setImageUrlInput(e.target.value)}
          />
          <button
            onClick={() => p.onSave(p.imageUrlInput.trim() || null)}
            disabled={busy}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--gray-300)",
              background: "#f9fafb",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {p.savingImageUrl ? "..." : "저장"}
          </button>
          {uploadBtn}
          {p.wine.image_url && (
            <button
              onClick={() => {
                if (!confirm("이미지를 삭제하시겠습니까?")) return;
                p.onSave(null);
              }}
              disabled={busy}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #fee2e2",
                background: "#fef2f2",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: "var(--status-danger)",
              }}
            >
              삭제
            </button>
          )}
        </div>
      )}
      {uploadErr && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--status-danger)" }}>{uploadErr}</div>
      )}
      {p.regeneratingNote && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-tertiary)" }}>
          ⏳ 새 이미지로 테이스팅 노트(PPTX·PDF) 재생성·업로드 중…
        </div>
      )}
    </div>
  );
}
