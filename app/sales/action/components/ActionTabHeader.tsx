"use client";

type Props = {
  isAdmin: boolean;
  managers: string[];
  selectedManager: string;
  setSelectedManager: (v: string) => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  scanning: boolean;
  currentMgr: string;
  onRescan: () => void;
  lastScanned: string | null;
};

export function ActionTabHeader(p: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          오늘의 액션
        </h2>
        {p.lastScanned && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
            마지막 스캔: {new Date(p.lastScanned).toLocaleString("ko-KR")}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {p.isAdmin && (
          <select
            value={p.selectedManager}
            onChange={(e) => p.setSelectedManager(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid rgba(90,21,21,0.08)",
              fontSize: 16,
              background: "#fff",
              color: p.selectedManager ? "var(--text-primary)" : "#999",
              outline: "none",
            }}
          >
            <option value="">담당자 선택</option>
            {p.managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => p.setCompactMode(!p.compactMode)}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            border: `1.5px solid ${p.compactMode ? "var(--action)" : "rgba(90,21,21,0.08)"}`,
            background: p.compactMode ? "rgba(90,21,21,0.06)" : "white",
            fontSize: 11,
            fontWeight: 600,
            color: p.compactMode ? "var(--action)" : "#999",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {p.compactMode ? "간략" : "상세"}
        </button>
        <button
          onClick={p.onRescan}
          disabled={p.scanning || !p.currentMgr}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid rgba(90,21,21,0.08)",
            background: p.scanning ? "var(--surface-muted)" : "white",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-tertiary)",
            cursor: p.scanning || !p.currentMgr ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: p.scanning ? "spin 1s linear infinite" : "none" }}
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {p.scanning ? "스캔 중..." : "새로고침"}
        </button>
      </div>
    </div>
  );
}
