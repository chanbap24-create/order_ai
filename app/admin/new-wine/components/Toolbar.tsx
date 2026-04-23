"use client";

import type { StatusFilter } from "../types";
import { STATUS_FILTERS, STATUS_FILTER_LABELS } from "../constants";
import type { useBatchOperations } from "../hooks/useBatchOperations";

type Props = {
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
  search: string;
  setSearch: (s: string) => void;
  checkedSize: number;
  ops: ReturnType<typeof useBatchOperations>;
};

const btnBase: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: 6,
  border: "none",
  fontSize: "0.75rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export function Toolbar(p: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            display: "inline-flex",
            background: "rgba(90,21,21,0.05)",
            borderRadius: 8,
            padding: 2,
          }}
        >
          {STATUS_FILTERS.map((f) => {
            const isActive = p.statusFilter === f;
            return (
              <button
                key={f}
                onClick={() => p.setStatusFilter(f)}
                style={{
                  ...btnBase,
                  background: isActive ? "white" : "transparent",
                  color: isActive ? "#5A1515" : "#a8a098",
                  boxShadow: isActive ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
                }}
              >
                {STATUS_FILTER_LABELS[f]} ({p.counts[f]})
              </button>
            );
          })}
        </div>
        <input
          style={{
            padding: "6px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 16,
            width: 200,
          }}
          placeholder="와인명/품번 검색..."
          value={p.search}
          onChange={(e) => p.setSearch(e.target.value)}
        />
        <button
          onClick={p.ops.batchResearch}
          disabled={p.ops.batchRunning || p.checkedSize === 0}
          style={{
            ...btnBase,
            background: p.ops.batchRunning ? "#5A1515" : "rgba(90,21,21,0.05)",
            color: p.ops.batchRunning ? "#fff" : "#a8a098",
            opacity: p.checkedSize === 0 && !p.ops.batchRunning ? 0.5 : 1,
          }}
        >
          {p.ops.batchRunning
            ? `${p.ops.batchProgress.current}/${p.ops.batchProgress.total} 조사 중...`
            : `일괄조사 (${p.checkedSize})`}
        </button>
        <button
          onClick={p.ops.batchPptGenerate}
          disabled={p.ops.batchPptRunning || p.checkedSize === 0}
          style={{
            ...btnBase,
            background: p.ops.batchPptRunning ? "#5A1515" : "rgba(90,21,21,0.05)",
            color: p.ops.batchPptRunning ? "#fff" : "#a8a098",
            opacity: p.checkedSize === 0 ? 0.5 : 1,
          }}
        >
          {p.ops.batchPptRunning
            ? `${p.ops.batchPptProgress.current}/${p.ops.batchPptProgress.total} PPT...`
            : `일괄PPT (${p.checkedSize})`}
        </button>
        <button
          onClick={() => p.ops.githubRelease("pptx")}
          disabled={p.ops.uploadingGithub || p.checkedSize === 0}
          style={{
            ...btnBase,
            background: "rgba(90,21,21,0.05)",
            color: "#a8a098",
            opacity: p.checkedSize === 0 ? 0.5 : 1,
          }}
        >
          {p.ops.uploadingGithub ? "업로드..." : "PPTX"}
        </button>
        <button
          onClick={() => p.ops.githubRelease("pdf")}
          disabled={p.ops.uploadingGithub || p.checkedSize === 0}
          style={{
            ...btnBase,
            background: "rgba(90,21,21,0.05)",
            color: "#a8a098",
            opacity: p.checkedSize === 0 ? 0.5 : 1,
          }}
        >
          {p.ops.uploadingGithub ? "업로드..." : "PDF"}
        </button>
        <button
          onClick={p.ops.dispatchIndex}
          disabled={p.ops.dispatchingIndex}
          style={{ ...btnBase, background: "rgba(90,21,21,0.05)", color: "#a8a098" }}
        >
          {p.ops.dispatchingIndex ? "실행 중..." : "인덱스"}
        </button>
      </div>
    </div>
  );
}
