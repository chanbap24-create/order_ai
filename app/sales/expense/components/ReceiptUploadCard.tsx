"use client";

import { Section } from "@/app/components/ui";
import { btnSecondary } from "@/app/styles/controls";

type Props = {
  receiptPreview: string;
  parsing: boolean;
  receiptInputRef: React.RefObject<HTMLInputElement | null>;
  onReceiptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/**
 * 영수증 촬영/업로드 카드.
 * - 헤더 + 액션 버튼이 한 줄에 baseline 정렬
 * - 프리뷰 이미지는 헤더 아래 80px 썸네일 + 파싱 spinner
 */
export function ReceiptUploadCard(p: Props) {
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
        <CameraIcon />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          영수증 촬영
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => p.receiptInputRef.current?.click()}
          style={btnSecondary}
        >
          <CameraIcon size={13} />
          {p.receiptPreview ? "다시 촬영" : "촬영 / 업로드"}
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
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginTop: 12,
            padding: 12,
            background: "var(--surface-muted)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          <img
            src={p.receiptPreview}
            alt="영수증"
            style={{
              width: 80,
              height: 80,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface)",
              flexShrink: 0,
            }}
          />
          {p.parsing ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--action)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Spinner />
              AI 파싱 중...
            </div>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                lineHeight: 1.5,
              }}
            >
              영수증 파싱이 완료되었습니다.
              <br />
              아래 항목을 확인하고 저장하세요.
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </Section>
  );
}

function CameraIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--action)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        border: "2px solid var(--action-muted)",
        borderTopColor: "var(--action)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
      }}
    />
  );
}
