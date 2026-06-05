"use client";

type Props = {
  batchRunning: boolean;
  batchProgress: { current: number; total: number; currentName: string };
  batchPptRunning: boolean;
  batchPptProgress: { current: number; total: number };
};

export function ProgressBars(p: Props) {
  return (
    <>
      {p.batchRunning && (
        <div
          style={{
            padding: "8px 12px",
            background: "#f5f3ff",
            borderRadius: 6,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 4, color: "#6d28d9", fontWeight: 600 }}>
            {p.batchProgress.current}/{p.batchProgress.total} 조사 중... (현재: {p.batchProgress.currentName})
          </div>
          <Bar current={p.batchProgress.current} total={p.batchProgress.total} color="#7c3aed" />
        </div>
      )}

      {p.batchPptRunning && (
        <div
          style={{
            padding: "8px 12px",
            background: "#e0f2fe",
            borderRadius: 6,
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 4, color: "#0369a1", fontWeight: 600 }}>
            {p.batchPptProgress.current}/{p.batchPptProgress.total} PPT 생성 중...
          </div>
          <Bar current={p.batchPptProgress.current} total={p.batchPptProgress.total} color="#0ea5e9" />
        </div>
      )}
    </>
  );
}

function Bar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div style={{ height: 4, background: "var(--gray-200)", borderRadius: 2 }}>
      <div
        style={{
          height: "100%",
          background: color,
          borderRadius: 2,
          width: `${pct}%`,
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}
