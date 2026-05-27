"use client";

import type { ExcludedWine, ManagerStat, WineShipment } from "../types";
import { WineRow } from "./WineRow";

type Props = {
  activeData: ManagerStat;
  excludedWines: Set<string>;
  setExcludedWines: React.Dispatch<React.SetStateAction<Set<string>>>;
  excludedWineDetails: ExcludedWine[];
  setExcludedWineDetails: React.Dispatch<React.SetStateAction<ExcludedWine[]>>;
  toggleExcludeWine: (name: string, info?: { supply_price: number; region: string | null }) => void;
  setPendingRecalc: (v: boolean) => void;
  expandedWine: string | null;
  onWineClick: (name: string, itemCodes: string) => void;
  wineShipments: WineShipment[];
  shipLoading: boolean;
  shipShowAll: boolean;
  setShipShowAll: React.Dispatch<React.SetStateAction<boolean>>;
};

const GRID = "36px 1fr 70px 70px 70px 60px 50px 90px";

export function WinesTab(p: Props) {
  const details = p.activeData.wine_details || [];
  const wineNames = details.map((w) => w.item_name);
  const allChecked = wineNames.length > 0 && wineNames.every((n) => p.excludedWines.has(n));
  const someChecked = wineNames.some((n) => p.excludedWines.has(n));
  const checkedCount = wineNames.filter((n) => p.excludedWines.has(n)).length;

  const toggleAll = () => {
    if (allChecked) {
      p.setExcludedWines((prev) => {
        const next = new Set(prev);
        for (const n of wineNames) next.delete(n);
        return next;
      });
      p.setExcludedWineDetails((d) => d.filter((w) => !wineNames.includes(w.item_name)));
    } else {
      p.setExcludedWines((prev) => {
        const next = new Set(prev);
        for (const n of wineNames) next.add(n);
        return next;
      });
      const existing = new Set(p.excludedWineDetails.map((w) => w.item_name));
      const toAdd = details
        .filter((w) => !existing.has(w.item_name))
        .map((w) => ({
          item_name: w.item_name,
          supply_price: w.supply_price,
          region: w.region,
        }));
      if (toAdd.length) p.setExcludedWineDetails((d) => [...d, ...toAdd]);
    }
    p.setPendingRecalc(true);
  };

  const unchecked = details.filter((w) => !p.excludedWines.has(w.item_name));
  const totalQty = unchecked.reduce((s, w) => s + w.corrected_qty, 0);
  const totalProfit = unchecked
    .filter((w) => w.avg_import_cost > 0 && w.avg_selling_price > 0)
    .reduce((s, w) => s + (w.avg_selling_price - w.avg_import_cost) * w.corrected_qty, 0);
  const totalCost = unchecked
    .filter((w) => w.avg_import_cost > 0)
    .reduce((s, w) => s + w.avg_import_cost * w.corrected_qty, 0);
  const avgMargin = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

  const prevExcluded = p.excludedWineDetails.filter((ew) => !wineNames.includes(ew.item_name));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked && !allChecked;
            }}
            onChange={toggleAll}
            style={{ width: 14, height: 14, accentColor: "var(--action)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "#999" }}>
            {checkedCount > 0 ? `${checkedCount}개 선택` : "전체"}
          </span>
        </div>
        {checkedCount > 0 && <span style={{ fontSize: 11, color: "#e67e22" }}>재계산 시 제외</span>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          padding: "6px 20px",
          fontSize: 10,
          color: "#bbb",
          fontWeight: 500,
          borderBottom: "1px solid #eee",
          textTransform: "uppercase" as const,
          letterSpacing: "0.03em",
        }}
      >
        <div></div>
        <div>와인</div>
        <div style={{ textAlign: "right" }}>공급가</div>
        <div style={{ textAlign: "right" }}>평균가</div>
        <div style={{ textAlign: "right" }}>원가</div>
        <div style={{ textAlign: "right" }}>이익</div>
        <div style={{ textAlign: "right" }}>거래처</div>
        <div style={{ textAlign: "right" }}>판매</div>
      </div>

      {details.map((w, i) => (
        <WineRow
          key={w.item_code}
          w={w}
          isLast={i === details.length - 1}
          isChecked={p.excludedWines.has(w.item_name)}
          isExpanded={p.expandedWine === w.item_name}
          onToggleExclude={() =>
            p.toggleExcludeWine(w.item_name, {
              supply_price: w.supply_price,
              region: w.region,
            })
          }
          onClick={() => p.onWineClick(w.item_name, w.item_code)}
          wineShipments={p.wineShipments}
          shipLoading={p.shipLoading}
          shipShowAll={p.shipShowAll}
          setShipShowAll={p.setShipShowAll}
        />
      ))}

      {/* 합계 행 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          padding: "8px 20px",
          background: "#111",
          fontWeight: 600,
          color: "#fff",
          fontSize: 12,
        }}
      >
        <div></div>
        <div>{unchecked.length}개</div>
        <div></div>
        <div></div>
        <div></div>
        <div style={{ textAlign: "right" }}>{avgMargin}%</div>
        <div></div>
        <div style={{ textAlign: "right" }}>{totalQty.toLocaleString()}</div>
      </div>

      {/* 이전 제외 목록 */}
      {prevExcluded.length > 0 && (
        <div style={{ borderTop: "1px dashed #ddd" }}>
          <div style={{ padding: "6px 20px", fontSize: 10, fontWeight: 500, color: "#bbb" }}>
            이전 제외 ({prevExcluded.length})
          </div>
          {prevExcluded.map((ew, idx) => (
            <div
              key={`excl-${idx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 90px",
                padding: "6px 20px",
                alignItems: "center",
                opacity: 0.4,
              }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => p.toggleExcludeWine(ew.item_name)}
                  style={{ width: 14, height: 14, accentColor: "#c0392b", cursor: "pointer" }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#999", textDecoration: "line-through" }}>
                {ew.item_name}
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#bbb" }}>
                {ew.supply_price?.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
