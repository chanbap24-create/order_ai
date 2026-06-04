"use client";

type Props = {
  onClick: () => void;
  itemCount: number;
};

/** 모바일 우하단 플로팅 장바구니 버튼 (배지 포함) */
export function FloatingCartButton({ onClick, itemCount }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--action)",
        color: "white",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(90,21,21,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        fontSize: 22,
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {itemCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            background: "var(--color-error)",
            color: "white",
            borderRadius: 10,
            padding: "2px 6px",
            fontSize: 11,
            fontWeight: 700,
            minWidth: 20,
            textAlign: "center",
            lineHeight: "16px",
          }}
        >
          {itemCount}
        </span>
      )}
    </button>
  );
}
