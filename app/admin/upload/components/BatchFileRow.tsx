"use client";

import type { BatchFile, DetectedType } from "../types";
import { BATCH_TYPE_OPTIONS } from "../constants";
import { Spinner } from "./Spinner";

type Props = {
  f: BatchFile;
  effectiveType: DetectedType;
  onOverride: (type: DetectedType) => void;
  onRemove: () => void;
};

export function BatchFileRow({ f, effectiveType, onOverride, onRemove }: Props) {
  const isOverridden = !!f.overrideType;
  const typeLabel = BATCH_TYPE_OPTIONS.find((o) => o.value === effectiveType)?.label || "알 수 없음";

  const statusIcon = () => {
    if (f.status === "success") return <span style={{ color: "#2E7D32", fontSize: 18 }}>✓</span>;
    if (f.status === "error") return <span style={{ color: "#C62828", fontSize: 18 }}>✗</span>;
    if (f.status === "uploading") return <Spinner />;
    return null;
  };

  const confColor = f.confidence === "high" ? "#2E7D32" : f.confidence === "medium" ? "#E65100" : "#C62828";
  const confLabel = f.confidence === "high" ? "확실" : f.confidence === "medium" ? "추정" : "불확실";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background:
          f.status === "success"
            ? "rgba(52,199,89,0.06)"
            : f.status === "error"
              ? "rgba(255,59,48,0.06)"
              : "var(--color-card)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${
          f.status === "success"
            ? "rgba(52,199,89,0.2)"
            : f.status === "error"
              ? "rgba(255,59,48,0.2)"
              : "var(--color-border)"
        }`,
      }}
    >
      <div style={{ width: 24, display: "flex", justifyContent: "center" }}>{statusIcon()}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {f.file.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-lighter)", marginTop: 1 }}>
          {f.reason}
          {f.message && f.status !== "pending" && <span> · {f.message}</span>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            background:
              effectiveType === "unknown"
                ? "#FFEBEE"
                : isOverridden
                  ? "#E3F2FD"
                  : "rgba(52,199,89,0.1)",
            color: effectiveType === "unknown" ? "#C62828" : isOverridden ? "#1565C0" : "#2E7D32",
          }}
        >
          {typeLabel}
        </span>
        {!isOverridden && effectiveType !== "unknown" && (
          <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{confLabel}</span>
        )}
      </div>

      {f.status === "pending" && (
        <select
          value={effectiveType}
          onChange={(e) => onOverride(e.target.value as DetectedType)}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            cursor: "pointer",
            minWidth: 100,
          }}
        >
          {BATCH_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {f.status === "pending" && (
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-lighter)",
            fontSize: 18,
            padding: "0 4px",
            lineHeight: 1,
          }}
          title="제거"
        >
          ×
        </button>
      )}
    </div>
  );
}
