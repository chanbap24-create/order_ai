"use client";

import type { AnalysisFilters, SelectedRankClient } from "../types";
import { useAnalysisData } from "../hooks/useAnalysisData";
import { AnalysisStyles } from "./AnalysisStyles";
import { TypeToggle } from "./TypeToggle";
import { FilterCard } from "./FilterCard";
import { SummaryCards } from "./SummaryCards";
import { ChartGrid } from "./ChartGrid";
import { ItemRankingTable } from "./ItemRankingTable";
import { ClientRankingTable } from "./ClientRankingTable";
import { PriceDistributionChart } from "./PriceDistributionChart";

type Props = {
  currentManager: string;
  isAdmin: boolean;
  onSelectClient: (client: SelectedRankClient, filters: AnalysisFilters) => void;
};

export function AnalysisSection({ currentManager, isAdmin, onSelectClient }: Props) {
  const s = useAnalysisData({ currentManager, isAdmin });
  const isWine = s.type === "wine";
  const activeManager = isAdmin ? s.manager : currentManager;
  const handleSelectClient = (c: SelectedRankClient) =>
    onSelectClient(c, {
      type: s.type,
      startDate: s.startDate,
      endDate: s.endDate,
      manager: activeManager,
    });

  const filterLabel = [
    (isAdmin ? s.manager : currentManager) && `담당: ${isAdmin ? s.manager : currentManager}`,
    s.clientName && `거래처: ${s.clientName}`,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <>
      <AnalysisStyles />

      <div style={{ opacity: s.mounted ? 1 : 0, transition: "opacity 0.3s ease" }}>
        <TypeToggle
          type={s.type}
          setType={s.setType}
          isAdmin={isAdmin}
          currentManager={currentManager}
        />

        <FilterCard
          isAdmin={isAdmin}
          filters={s.filters}
          dateRange={s.dateRange}
          manager={s.manager}
          setManager={s.setManager}
          startDate={s.startDate}
          endDate={s.endDate}
          setStartDate={s.setStartDate}
          setEndDate={s.setEndDate}
          preset={s.preset}
          setPreset={s.setPreset}
          clientSearch={s.clientSearch}
          clientCode={s.clientCode}
          handleClientSearch={s.handleClientSearch}
          clearClient={s.clearClient}
          suggestions={s.suggestions}
          showSuggestions={s.showSuggestions}
          setShowSuggestions={s.setShowSuggestions}
          selectClient={s.selectClient}
          loading={s.loading}
          onLoad={s.loadData}
        />

        {s.loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #eee",
                borderTopColor: "var(--action)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: "0.82rem" }}>데이터 분석 중...</p>
          </div>
        )}

        {s.data && !s.loading && (
          <>
            {filterLabel && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 16 }}>
                {filterLabel}
              </p>
            )}

            <SummaryCards
              totalRevenue={s.data.summary?.totalRevenue || 0}
              avgDiscount={s.data.summary?.avgDiscount || 0}
            />

            <div
              style={{
                fontSize: "0.92rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              출고 {isWine ? "와인" : "리델"} 분석
            </div>

            {isWine && (
              <ChartGrid
                byCountry={s.data.byCountry}
                byRegion={s.data.byRegion}
                byType={s.data.byType}
                byGrape={s.data.byGrape}
              />
            )}

            <ItemRankingTable items={s.data.itemRanking || []} prevRanking={s.data.prevRanking} />

            <ClientRankingTable
              clients={s.rankClients}
              stats={s.rankStats}
              loading={s.rankLoading}
              onSelectClient={handleSelectClient}
            />

            <PriceDistributionChart data={s.data.byPrice} />
          </>
        )}
      </div>
    </>
  );
}
