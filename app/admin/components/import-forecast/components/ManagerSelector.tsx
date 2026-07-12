"use client";

import type { DetailTab, ManagerStat } from "../types";

type Props = {
  results: ManagerStat[];
  activeManager: string | null;
  setActiveManager: (m: string) => void;
  setDetailTab: (t: DetailTab) => void;
  isNewItem: boolean;
  displayTotal: number;
  totalClients: number;
};

export function ManagerSelector(p: Props) {
  const allActive = p.activeManager === "__all__";

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginBottom: 20,
        overflowX: "auto",
        paddingBottom: 4,
      }}
    >
      <button
        onClick={() => {
          p.setActiveManager("__all__");
          p.setDetailTab("wines");
        }}
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          border: allActive ? "1.5px solid var(--neutral-900)" : "1px solid var(--border-default)",
          background: allActive ? "var(--neutral-900)" : "#fff",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: allActive ? "#fff" : "var(--neutral-400)" }}>
          전체
        </div>
        <div
          style={{
            fontSize: 11,
            marginTop: 2,
            color: allActive ? "rgba(255,255,255,0.6)" : "var(--gray-400)",
          }}
        >
          {p.displayTotal}병 · {p.totalClients}곳
        </div>
      </button>
      {p.results.map((r) => {
        const isActive = p.activeManager === r.manager;
        const displayQty = p.isNewItem
          ? r.qty_per_item_year1 ?? r.qty_per_item
          : r.qty_per_item;
        return (
          <button
            key={r.manager}
            onClick={() => {
              p.setActiveManager(r.manager);
              p.setDetailTab("wines");
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: isActive ? "1.5px solid var(--action)" : "1px solid var(--border-default)",
              background: isActive ? "var(--action)" : "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "var(--neutral-700)" }}>
              {r.manager}
            </div>
            <div
              style={{
                fontSize: 11,
                marginTop: 2,
                color: isActive ? "rgba(255,255,255,0.6)" : "var(--gray-400)",
              }}
            >
              {displayQty}병{p.isNewItem ? ` →${r.qty_per_item}` : ""} · {r.avg_clients}곳
            </div>
          </button>
        );
      })}
    </div>
  );
}
