"use client";

import type { Wine } from "@/app/types/wine";

type Props = {
  wine: Wine;
  imageUrlInput: string;
  setImageUrlInput: (s: string) => void;
  imageUrlExpanded: boolean;
  setImageUrlExpanded: (b: boolean) => void;
  savingImageUrl: boolean;
  onSave: (url: string | null) => Promise<void>;
};

export function ImageSection(p: Props) {
  return (
    <div style={{ marginBottom: 16 }}>
      {p.wine.image_url && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img
            src={p.wine.image_url}
            alt={p.wine.item_name_kr}
            style={{ maxHeight: 200, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
        </div>
      )}
      {p.wine.image_url && !p.imageUrlExpanded ? (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => p.setImageUrlExpanded(true)}
            style={{
              fontSize: 12,
              color: "#9ca3af",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            이미지 URL 변경
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            style={{
              flex: 1,
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 16,
            }}
            placeholder="이미지 URL 입력..."
            value={p.imageUrlInput}
            onChange={(e) => p.setImageUrlInput(e.target.value)}
          />
          <button
            onClick={() => p.onSave(p.imageUrlInput.trim() || null)}
            disabled={p.savingImageUrl}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {p.savingImageUrl ? "..." : "저장"}
          </button>
          {p.wine.image_url && (
            <button
              onClick={() => {
                if (!confirm("이미지를 삭제하시겠습니까?")) return;
                p.onSave(null);
              }}
              disabled={p.savingImageUrl}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #fee2e2",
                background: "#fef2f2",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: "#dc2626",
              }}
            >
              삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
