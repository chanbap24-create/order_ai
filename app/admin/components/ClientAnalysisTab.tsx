'use client';

import { useState } from 'react';
import { useClientAnalysisData } from '../client-analysis/hooks/useClientAnalysisData';
import { useClientDetailSheet } from '../client-analysis/hooks/useClientDetailSheet';
import type { BizView, TrendPeriod } from '../client-analysis/types';
import { TypeToggle } from '../client-analysis/components/TypeToggle';
import { FilterBar } from '../client-analysis/components/FilterBar';
import { SummaryCards } from '../client-analysis/components/SummaryCards';
import { ManagerAnalysisTable } from '../client-analysis/components/ManagerAnalysisTable';
import { BusinessBrandPie } from '../client-analysis/components/BusinessBrandPie';
import { TrendChart } from '../client-analysis/components/TrendChart';
import { YoYChart } from '../client-analysis/components/YoYChart';
import { ClientRankingTable } from '../client-analysis/components/ClientRankingTable';
import { RegionSalesCard } from '../client-analysis/components/RegionSalesCard';
import { ClientDetailSheet } from '../client-analysis/components/ClientDetailSheet';

export default function ClientAnalysisTab() {
  const {
    type, changeType,
    filters, filterLoading,
    filterState, updateFilter, resetFilters,
    data, lastYearTrend, loading,
  } = useClientAnalysisData();

  const [bizView, setBizView] = useState<BizView>('business');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily');

  const detail = useClientDetailSheet(type, filterState.startDate, filterState.endDate);

  return (
    <div>
      <TypeToggle type={type} onChange={changeType} />

      <FilterBar
        filters={filters}
        filterLoading={filterLoading}
        state={filterState}
        update={updateFilter}
        reset={resetFilters}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)', fontSize: 'var(--text-sm)' }}>
          데이터 로딩 중...
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-lighter)' }}>
          데이터가 없습니다. 출고현황 엑셀을 먼저 업로드하세요.
        </div>
      ) : (
        <>
          <SummaryCards data={data} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
            <ManagerAnalysisTable data={data.managerAnalysis} />
            <BusinessBrandPie data={data} view={bizView} onViewChange={setBizView} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <RegionSalesCard type={type} startDate={filterState.startDate} endDate={filterState.endDate} />
          </div>

          <TrendChart
            dailyTrend={data.dailyTrend}
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
          />

          <YoYChart
            thisYearTrend={data.dailyTrend}
            lastYearTrend={lastYearTrend}
            startDate={filterState.startDate}
          />

          <ClientRankingTable
            ranking={data.clientRanking}
            onRowClick={detail.open}
          />
        </>
      )}

      <ClientDetailSheet
        selectedClient={detail.selectedClient}
        items={detail.clientItems}
        loading={detail.loading}
        onClose={detail.close}
      />
    </div>
  );
}
