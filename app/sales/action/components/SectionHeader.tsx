"use client";

import type React from "react";

type Props = {
  title: string;
  titleColor: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  suffix?: React.ReactNode;
};

/** 접기/펼치기 섹션 헤더 (▼ 아이콘 + 제목 + 카운트 배지) */
export function SectionHeader({
  title,
  titleColor,
  count,
  collapsed,
  onToggle,
  suffix,
}: Props) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "10px 0",
        border: "none",
        background: "none",
        cursor: "pointer",
        borderBottom: "1px solid var(--action-muted)",
        marginBottom: collapsed ? 0 : 12,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          transition: "transform 0.2s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        }}
      >
        ▼
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color: titleColor }}>
        {title}
      </span>
      {suffix}
      <span
        style={{
          fontSize: 11,
          color: "white",
          background: count > 0 ? titleColor : "var(--gray-300)",
          borderRadius: 99,
          padding: "1px 8px",
          fontWeight: 600,
          marginLeft: suffix ? "auto" : undefined,
        }}
      >
        {count}
      </span>
    </button>
  );
}
