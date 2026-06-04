"use client";

import type { NoteFilter } from "../types";
import { NOTE_FILTERS, NOTE_FILTER_LABELS } from "../constants";
import type { useTastingNoteBatch } from "../hooks/useTastingNoteBatch";

type Props = {
  filterNote: NoteFilter;
  setFilterNote: (f: NoteFilter) => void;
  counts: Record<NoteFilter, number>;
  search: string;
  setSearch: (s: string) => void;
  hideZero: boolean;
  setHideZero: (b: boolean) => void;
  wineOnly: boolean;
  setWineOnly: (b: boolean) => void;
  lowStockThreshold: number;
  setLowStockThreshold: (n: number) => void;
  checkedSize: number;
  ops: ReturnType<typeof useTastingNoteBatch>;
};

const btn: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: 6,
  border: "none",
  fontSize: "0.75rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "#d1d5db",
  margin: "0 2px",
};

export function NoteToolbar(p: Props) {
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
          {NOTE_FILTERS.map((f) => {
            const isActive = p.filterNote === f;
            return (
              <button
                key={f}
                onClick={() => p.setFilterNote(f)}
                style={{
                  ...btn,
                  background: isActive ? "white" : "transparent",
                  color: isActive ? "var(--action)" : "var(--text-muted)",
                  boxShadow: isActive ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
                }}
              >
                {NOTE_FILTER_LABELS[f]} ({p.counts[f]})
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
        <div style={{ display: "inline-flex", background: "rgba(90,21,21,0.05)", borderRadius: 8, padding: 2 }}>
          <button
            onClick={() => p.setHideZero(!p.hideZero)}
            title="재고 0 인 품목 숨기기"
            style={{
              ...btn,
              background: p.hideZero ? "white" : "transparent",
              color: p.hideZero ? "var(--action)" : "var(--text-muted)",
              boxShadow: p.hideZero ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
            }}
          >
            재고만
          </button>
          <button
            onClick={() => p.setWineOnly(!p.wineOnly)}
            title="자재/세트/타사 제품 제외 — item_code 첫 글자가 와인 카테고리(0~5, A)인 것만"
            style={{
              ...btn,
              background: p.wineOnly ? "white" : "transparent",
              color: p.wineOnly ? "var(--action)" : "var(--text-muted)",
              boxShadow: p.wineOnly ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
            }}
          >
            와인만
          </button>
          <div
            title="재고 N병 이하 와인 숨기기 — 0 이면 끔. 곧 소진될 와인을 노트 작성 대상에서 제외하기 위함"
            style={{
              ...btn,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: p.lowStockThreshold > 0 ? "white" : "transparent",
              color: p.lowStockThreshold > 0 ? "var(--action)" : "var(--text-muted)",
              boxShadow:
                p.lowStockThreshold > 0 ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
              cursor: "default",
            }}
          >
            <span>재고 ≤</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={p.lowStockThreshold}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                p.setLowStockThreshold(Number.isFinite(v) && v >= 0 ? v : 0);
              }}
              style={{
                width: 44,
                padding: "1px 4px",
                fontSize: 12,
                border: "1px solid #d1d5db",
                borderRadius: 4,
                textAlign: "center",
                color: "var(--text-primary)",
                background: "#fff",
              }}
            />
            <span>병 숨김</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button
          onClick={p.ops.batchResearch}
          disabled={p.ops.batchRunning || p.checkedSize === 0}
          style={{
            ...btn,
            background: p.ops.batchRunning ? "var(--action)" : "rgba(90,21,21,0.05)",
            color: p.ops.batchRunning ? "#fff" : "var(--text-muted)",
            opacity: p.checkedSize === 0 && !p.ops.batchRunning ? 0.5 : 1,
          }}
        >
          {p.ops.batchRunning
            ? `${p.ops.batchProgress.current}/${p.ops.batchProgress.total} 조사 중...`
            : `일괄조사 (${p.checkedSize})`}
        </button>
        <div style={DIVIDER} />
        {(["pptx", "pdf"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => p.ops.batchDownload(fmt)}
            disabled={!!p.ops.batchDownloading || p.checkedSize === 0}
            style={{
              ...btn,
              background: p.ops.batchDownloading === fmt ? "var(--status-info)" : "rgba(90,21,21,0.05)",
              color: p.ops.batchDownloading === fmt ? "#fff" : "var(--text-muted)",
              opacity: p.checkedSize === 0 && !p.ops.batchDownloading ? 0.5 : 1,
            }}
          >
            {p.ops.batchDownloading === fmt ? "생성중..." : fmt.toUpperCase()}
          </button>
        ))}
        <div style={DIVIDER} />
        {(["pptx", "pdf"] as const).map((fmt) => (
          <button
            key={"gh-" + fmt}
            onClick={() => p.ops.githubRelease(fmt)}
            disabled={p.ops.uploadingGithub || p.checkedSize === 0}
            style={{
              ...btn,
              background: "rgba(90,21,21,0.05)",
              color: "var(--text-muted)",
              opacity: p.checkedSize === 0 ? 0.5 : 1,
            }}
          >
            {p.ops.uploadingGithub ? "업로드..." : `GH ${fmt.toUpperCase()}`}
          </button>
        ))}
        <button
          onClick={p.ops.dispatchIndex}
          disabled={p.ops.dispatchingIndex}
          style={{ ...btn, background: "rgba(90,21,21,0.05)", color: "var(--text-muted)" }}
        >
          {p.ops.dispatchingIndex ? "실행 중..." : "인덱스"}
        </button>
      </div>
    </div>
  );
}
