"use client";

import type {
  DetailTab,
  ExcludedWine,
  LearningCurve,
  ManagerStat,
  WineShipment,
} from "../types";
import { WinesTab } from "./WinesTab";
import { YearsTab } from "./YearsTab";
import { ClientsTab } from "./ClientsTab";
import { ChannelsTab } from "./ChannelsTab";

type Props = {
  activeData: ManagerStat;
  detailTab: DetailTab;
  setDetailTab: (t: DetailTab) => void;
  isNewItem: boolean;
  learningCurve: LearningCurve | null;
  // wines tab wiring
  excludedWines: Set<string>;
  setExcludedWines: React.Dispatch<React.SetStateAction<Set<string>>>;
  excludedWineDetails: ExcludedWine[];
  setExcludedWineDetails: React.Dispatch<React.SetStateAction<ExcludedWine[]>>;
  toggleExcludeWine: (
    name: string,
    info?: { supply_price: number; region: string | null },
  ) => void;
  setPendingRecalc: (v: boolean) => void;
  expandedWine: string | null;
  onWineClick: (name: string, itemCodes: string) => void;
  wineShipments: WineShipment[];
  shipLoading: boolean;
  shipShowAll: boolean;
  setShipShowAll: React.Dispatch<React.SetStateAction<boolean>>;
};

export function ManagerDetailCard(p: Props) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--gray-200)",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", borderBottom: "1px solid var(--gray-200)" }}>
        {(
          [
            { id: "wines" as const, label: `와인 ${p.activeData.wine_details?.length || 0}` },
            { id: "years" as const, label: "연도별" },
            { id: "clients" as const, label: `거래처 ${p.activeData.top_clients?.length || 0}` },
            { id: "channels" as const, label: `채널 ${p.activeData.channels?.length || 0}` },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => p.setDetailTab(tab.id)}
            style={{
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: p.detailTab === tab.id ? 600 : 400,
              color: p.detailTab === tab.id ? "var(--neutral-900)" : "var(--neutral-100)",
              background: "transparent",
              border: "none",
              borderBottom:
                p.detailTab === tab.id ? "2px solid var(--neutral-900)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {p.detailTab === "wines" && p.activeData.wine_details && (
        <WinesTab
          activeData={p.activeData}
          excludedWines={p.excludedWines}
          setExcludedWines={p.setExcludedWines}
          excludedWineDetails={p.excludedWineDetails}
          setExcludedWineDetails={p.setExcludedWineDetails}
          toggleExcludeWine={p.toggleExcludeWine}
          setPendingRecalc={p.setPendingRecalc}
          expandedWine={p.expandedWine}
          onWineClick={p.onWineClick}
          wineShipments={p.wineShipments}
          shipLoading={p.shipLoading}
          shipShowAll={p.shipShowAll}
          setShipShowAll={p.setShipShowAll}
        />
      )}
      {p.detailTab === "years" && (
        <YearsTab
          activeData={p.activeData}
          isNewItem={p.isNewItem}
          learningCurve={p.learningCurve}
        />
      )}
      {p.detailTab === "clients" && p.activeData.top_clients && (
        <ClientsTab activeData={p.activeData} />
      )}
      {p.detailTab === "channels" && p.activeData.channels && (
        <ChannelsTab activeData={p.activeData} />
      )}
    </div>
  );
}
