"use client";

type Props = {
  excludeBulk: boolean;
  setExcludeBulk: (v: boolean) => void;
  bulkThreshold: number;
  setBulkThreshold: (v: number) => void;
  excludeSamples: boolean;
  setExcludeSamples: (v: boolean) => void;
  noCorrection: boolean;
  setNoCorrection: (v: boolean) => void;
  businessTypes: string[];
  excludedBizTypes: Set<string>;
  setExcludedBizTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  bizTypeOpen: boolean;
  setBizTypeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetResults: () => void;
};

export function ConditionFilterOptions(p: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 16,
        flexWrap: "wrap",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label style={checkLabel}>
          <input
            type="checkbox"
            checked={p.excludeBulk}
            onChange={(e) => {
              p.setExcludeBulk(e.target.checked);
              p.resetResults();
            }}
            style={{ width: 14, height: 14, accentColor: "#5A1515", cursor: "pointer" }}
          />
          <span style={{ fontWeight: 500, color: "#333" }}>특판 제외</span>
        </label>
        <input
          type="number"
          value={p.bulkThreshold}
          onChange={(e) => {
            p.setBulkThreshold(Math.max(1, Number(e.target.value) || 60));
            p.resetResults();
          }}
          disabled={!p.excludeBulk}
          style={{
            width: 48,
            padding: "3px 4px",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "center",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            outline: "none",
            color: p.excludeBulk ? "#333" : "#ccc",
            background: "#fff",
          }}
        />
        <span style={{ fontSize: 11, color: "#aaa" }}>병+</span>
      </div>
      <label style={checkLabel}>
        <input
          type="checkbox"
          checked={p.excludeSamples}
          onChange={(e) => {
            p.setExcludeSamples(e.target.checked);
            p.resetResults();
          }}
          style={{ width: 14, height: 14, accentColor: "#5A1515", cursor: "pointer" }}
        />
        <span style={{ fontWeight: 500, color: "#333" }}>샘플 제외</span>
      </label>
      <label style={checkLabel}>
        <input
          type="checkbox"
          checked={p.noCorrection}
          onChange={(e) => {
            p.setNoCorrection(e.target.checked);
            p.resetResults();
          }}
          style={{ width: 14, height: 14, accentColor: "#5A1515", cursor: "pointer" }}
        />
        <span style={{ fontWeight: 500, color: "#333" }}>보정 제외</span>
      </label>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => p.setBizTypeOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            color: p.excludedBizTypes.size > 0 ? "#c0392b" : "#555",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          업종 {p.excludedBizTypes.size > 0 ? `(${p.excludedBizTypes.size} 제외)` : "전체"}
          <span style={{ fontSize: 9, color: "#bbb" }}>{p.bizTypeOpen ? "▲" : "▼"}</span>
        </button>
        {p.bizTypeOpen && (
          <div
            style={{
              position: "absolute",
              top: 30,
              left: 0,
              zIndex: 20,
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e0e0e0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              padding: "6px 4px",
              minWidth: 170,
            }}
          >
            {p.businessTypes.map((bt) => {
              const isExcluded = p.excludedBizTypes.has(bt);
              return (
                <label
                  key={bt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 10px",
                    cursor: "pointer",
                    userSelect: "none",
                    borderRadius: 4,
                    fontSize: 12,
                    color: isExcluded ? "#bbb" : "#333",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => {
                      p.setExcludedBizTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(bt)) next.delete(bt);
                        else next.add(bt);
                        return next;
                      });
                      p.resetResults();
                    }}
                    style={{ width: 13, height: 13, accentColor: "#5A1515", cursor: "pointer" }}
                  />
                  <span style={{ textDecoration: isExcluded ? "line-through" : "none" }}>{bt}</span>
                </label>
              );
            })}
            {p.excludedBizTypes.size > 0 && (
              <div style={{ borderTop: "1px solid #eee", marginTop: 4, paddingTop: 4 }}>
                <button
                  onClick={() => {
                    p.setExcludedBizTypes(new Set());
                    p.resetResults();
                  }}
                  style={{
                    width: "100%",
                    padding: "4px 10px",
                    fontSize: 11,
                    color: "#999",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  cursor: "pointer",
  userSelect: "none",
};
