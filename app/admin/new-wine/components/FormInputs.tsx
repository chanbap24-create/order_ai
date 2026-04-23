"use client";

import type React from "react";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#9ca3af", minWidth: 60 }}>{label}</span>
      <span style={{ color: "#1e293b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "#6b7280",
        margin: "16px 0 8px",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {title}
    </div>
  );
}

export function FormRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 13, color: "#374151", minWidth: 90, fontWeight: 500 }}>
        {label}
      </label>
      <input
        style={{
          flex: 1,
          padding: "7px 10px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 16,
        }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function FormTextarea({
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
    <div style={{ marginBottom: 8 }}>
      <label
        style={{
          fontSize: 13,
          color: "#374151",
          fontWeight: 500,
          display: "block",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <textarea
        style={{
          width: "100%",
          padding: "7px 10px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 16,
          resize: "vertical",
          lineHeight: 1.5,
        }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
      />
    </div>
  );
}

export function DetailSection({
  icon,
  title,
  content,
  children,
}: {
  icon: string;
  title: string;
  content?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#374151",
          marginBottom: 6,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 4,
        }}
      >
        {icon} {title}
      </div>
      {content ? (
        <div
          style={{
            fontSize: 12,
            color: "#4b5563",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </div>
      ) : children ? (
        <div>{children}</div>
      ) : (
        <div style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>정보 없음</div>
      )}
    </div>
  );
}

export function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#4b5563",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
