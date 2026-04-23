"use client";

import type React from "react";

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        background: "#f5f5f5",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        color: "#555",
      }}
    >
      {children}
    </span>
  );
}
