"use client";

import type { DownloadLog } from "../types";

type Props = {
  logs: DownloadLog[];
  logRef: React.RefObject<HTMLDivElement | null>;
  isBusy: boolean;
  phaseLabel: string;
  phase: "idle" | "downloading" | "uploading" | "done";
  successCount: number;
  failCount: number;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
};

export function SyncLogViewer(p: Props) {
  if (p.logs.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      {p.phase === "done" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-2) var(--space-3)",
            background: p.failCount === 0 ? "#f0fdf4" : "#fef2f2",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-2)",
            border: `1px solid ${p.failCount === 0 ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: p.failCount === 0 ? "var(--status-success)" : "var(--status-danger)",
            }}
          >
            {p.failCount === 0
              ? `${p.successCount}개 완료`
              : `${p.successCount}개 성공 / ${p.failCount}개 실패`}
          </span>
          <button
            onClick={() => p.setExpanded(!p.expanded)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-light)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {p.expanded ? "로그 접기" : "로그 보기"}
          </button>
        </div>
      )}

      {(p.expanded || p.isBusy) && (
        <div
          ref={p.logRef}
          style={{
            maxHeight: 200,
            overflowY: "auto",
            background: "#1e1e1e",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {p.logs.map((log, i) => {
            let color = "#d4d4d4";
            let prefix = "";
            if (log.type === "success") {
              color = "#4ade80";
              prefix = "✓ ";
            } else if (log.type === "fail" || log.type === "error") {
              color = "#f87171";
              prefix = "✗ ";
            } else if (log.type === "progress") {
              color = "#60a5fa";
              prefix = "▸ ";
            } else if (log.type === "info") {
              color = "#a78bfa";
              prefix = "  ";
            } else if (log.type === "summary" || log.type === "done") {
              color = "#fbbf24";
              prefix = "";
            }
            return (
              <div key={i} style={{ color, whiteSpace: "pre-wrap" }}>
                {prefix}
                {log.message}
              </div>
            );
          })}
          {p.isBusy && (
            <div style={{ color: "#60a5fa" }}>
              <span style={{ animation: "pulse 1.5s infinite" }}>●</span> {p.phaseLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
