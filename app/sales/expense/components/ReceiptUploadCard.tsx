"use client";

import { cardStyle } from "../styles";

type Props = {
  receiptPreview: string;
  parsing: boolean;
  receiptInputRef: React.RefObject<HTMLInputElement | null>;
  onReceiptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ReceiptUploadCard(p: Props) {
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
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        영수증 촬영/업로드
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => p.receiptInputRef.current?.click()}
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 10,
            border: "1.5px solid rgba(90,21,21,0.1)",
            background: "#faf9f7",
            fontSize: 13,
            fontWeight: 600,
            color: "#5A1515",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          카메라 촬영
        </button>
        <input
          ref={p.receiptInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={p.onReceiptUpload}
          style={{ display: "none" }}
        />
      </div>

      {p.receiptPreview && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <img
              src={p.receiptPreview}
              alt="영수증"
              style={{
                width: 100,
                height: "auto",
                borderRadius: 8,
                border: "1px solid rgba(90,21,21,0.08)",
                flexShrink: 0,
              }}
            />
            {p.parsing && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#8a8580",
                  fontSize: 13,
                  paddingTop: 8,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(90,21,21,0.15)",
                    borderTop: "2px solid #5A1515",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                AI 파싱 중...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
