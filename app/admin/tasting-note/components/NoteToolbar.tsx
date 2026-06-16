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
  showExcluded: boolean;
  setShowExcluded: (b: boolean) => void;
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
  background: "var(--gray-300)",
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
            border: "1px solid var(--gray-300)",
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
          <button
            onClick={() => p.setShowExcluded(!p.showExcluded)}
            title="제외(🚫) 처리한 품목만 표시 — 복원(↩)은 여기서"
            style={{
              ...btn,
              background: p.showExcluded ? "white" : "transparent",
              color: p.showExcluded ? "var(--action)" : "var(--text-muted)",
              boxShadow: p.showExcluded ? "0 1px 3px rgba(90,21,21,0.08)" : "none",
            }}
          >
            제외됨
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
                p.lowStockThreshold > 0 ? "0 1px 3px var(--border-default)" : "none",
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
                border: "1px solid var(--gray-300)",
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
        {(p.ops.batchRunning || p.ops.backfillRunning) && (
          <button
            onClick={p.ops.cancelBatchResearch}
            title="진행 중인 1건까지만 끝내고 멈춥니다"
            style={{ ...btn, background: "#dc2626", color: "#fff" }}
          >
            중지
          </button>
        )}
        <button
          onClick={p.ops.backfillSelected}
          disabled={p.ops.backfillRunning || p.checkedSize === 0}
          title="선택 와인의 발행 PPTX에서 기본정보+테이스팅노트 본문을 빈 칸만 채웁니다 (LLM 아님·무료). 전체선택 후 한 번에 가능."
          style={{
            ...btn,
            background: p.ops.backfillRunning ? "var(--action)" : "rgba(90,21,21,0.05)",
            color: p.ops.backfillRunning ? "#fff" : "var(--text-muted)",
            opacity: p.checkedSize === 0 && !p.ops.backfillRunning ? 0.5 : 1,
          }}
        >
          {p.ops.backfillRunning
            ? `${p.ops.batchProgress.current}/${p.ops.batchProgress.total} 동기화 중...`
            : `일괄동기화 (${p.checkedSize})`}
        </button>
        <button
          onClick={p.ops.batchPptGenerate}
          disabled={p.ops.batchPptRunning || p.checkedSize === 0}
          style={{
            ...btn,
            background: p.ops.batchPptRunning ? "var(--action)" : "rgba(90,21,21,0.05)",
            color: p.ops.batchPptRunning ? "#fff" : "var(--text-muted)",
            opacity: p.checkedSize === 0 && !p.ops.batchPptRunning ? 0.5 : 1,
          }}
        >
          {p.ops.batchPptRunning
            ? `${p.ops.batchPptProgress.current}/${p.ops.batchPptProgress.total} 생성 중...`
            : `일괄PPT (${p.checkedSize})`}
        </button>
        <div style={DIVIDER} />
        {(["pptx", "pdf"] as const).map((fmt) => (
          <button
            key={"gh-" + fmt}
            onClick={() => p.ops.githubRelease(fmt)}
            disabled={p.ops.uploadingGithub || p.checkedSize === 0}
            title={`선택한 와인의 ${fmt.toUpperCase()}를 생성해 릴리스에 업로드(발행)${fmt === "pdf" ? " + 인덱스 갱신" : ""}`}
            style={{
              ...btn,
              background: fmt === "pdf" ? "rgba(90,21,21,0.12)" : "rgba(90,21,21,0.05)",
              color: fmt === "pdf" ? "var(--action)" : "var(--text-muted)",
              fontWeight: fmt === "pdf" ? 700 : 600,
              opacity: p.checkedSize === 0 ? 0.5 : 1,
            }}
          >
            {p.ops.uploadingGithub ? "발행 중..." : `${fmt.toUpperCase()} 발행`}
          </button>
        ))}
        <button
          onClick={p.ops.dispatchIndex}
          disabled={p.ops.dispatchingIndex}
          title="릴리스에 이미 업로드된 PDF 목록으로 인덱스만 다시 만듦 (PDF는 생성하지 않음). 발행은 'PDF 발행' 버튼 사용."
          style={{ ...btn, background: "rgba(90,21,21,0.05)", color: "var(--text-muted)" }}
        >
          {p.ops.dispatchingIndex ? "실행 중..." : "인덱스 새로고침"}
        </button>
      </div>
    </div>
  );
}
