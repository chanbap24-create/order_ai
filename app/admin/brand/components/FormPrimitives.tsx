"use client";

import type React from "react";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--action-muted)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--action)", marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: 32,
          padding: "0 10px",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          fontSize: 13,
          outline: "none",
          background: "var(--gray-50)",
        }}
      />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          fontSize: 13,
          outline: "none",
          background: "var(--gray-50)",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "var(--text-primary)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 8,
        fontSize: 13,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        zIndex: 9999,
        animation: "fadeInSlide 0.3s ease",
      }}
    >
      {message}
    </div>
  );
}
