'use client';

import { useEffect, useState } from 'react';
import type { SourceMode, InvPeriod } from '../dashboard/types';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { computeInvChanges, computeInvLineSeries } from '../dashboard/lib/inventorySeries';
import { mergeRevArrays, mergeValArrays } from '../dashboard/lib/merge';
import { KpiCards } from '../dashboard/components/KpiCards';
import { InventoryCharts } from '../dashboard/components/InventoryCharts';
import { SourceToggle } from '../dashboard/components/SourceToggle';
import { PieAnalysisCard } from '../dashboard/components/PieAnalysisCard';
import { InventoryItemsTable } from '../dashboard/components/InventoryItemsTable';

export default function DashboardTab() {
  const { stats, analysis, glassAnalysis, loading } = useDashboardData();
  const [source, setSource] = useState<SourceMode>('all');
  const [invPeriod, setInvPeriod] = useState<InvPeriod>('daily');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (loading || !mounted) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>로딩 중...</div>;
  }
  if (!stats) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-error)' }}>데이터를 불러올 수 없습니다.</div>;
  }

  const totalInventory = (stats.cdvInventoryValue || 0) + (stats.dlInventoryValue || 0);
  const totalRevenue = analysis?.summary.totalRevenue ?? 0;

  const invChangeData = computeInvChanges(stats.inventoryHistory);
  const inventoryLineData = computeInvLineSeries(stats.inventoryHistory, invPeriod);

  // Sales analysis data per source
  const wBrand = analysis?.brandAnalysis || [];
  const gBrand = glassAnalysis?.brandAnalysis || [];
  const wCountry = analysis?.countryAnalysis || [];
  const gCountry = glassAnalysis?.countryAnalysis || [];
  const brandData = source === 'cdv' ? wBrand : source === 'dl' ? gBrand : mergeRevArrays(wBrand, gBrand);
  const countryData = source === 'cdv' ? wCountry : source === 'dl' ? gCountry : mergeRevArrays(wCountry, gCountry);
  const salesTotalRev = source === 'cdv'
    ? (analysis?.summary.totalRevenue ?? 0)
    : source === 'dl'
      ? (glassAnalysis?.summary.totalRevenue ?? 0)
      : (analysis?.summary.totalRevenue ?? 0) + (glassAnalysis?.summary.totalRevenue ?? 0);

  // Inventory by country/brand
  const cCdv = stats.inventoryByCountryCdv || [];
  const cDl = stats.inventoryByCountryDl || [];
  const bCdv = stats.inventoryByBrandCdv || [];
  const bDl = stats.inventoryByBrandDl || [];
  const countryInv = source === 'cdv' ? cCdv : source === 'dl' ? cDl : mergeValArrays(cCdv, cDl);
  const brandInv = source === 'cdv' ? bCdv : source === 'dl' ? bDl : mergeValArrays(bCdv, bDl);
  const countryInvTotal = countryInv.reduce((s, x) => s + x.value, 0);
  const brandInvTotal = brandInv.reduce((s, x) => s + x.value, 0);

  const showCdvItems = source !== 'dl' && (stats.inventoryByItemCdv?.length ?? 0) > 0;
  const showDlItems = source !== 'cdv' && (stats.inventoryByItemDl?.length ?? 0) > 0;

  const showSourceToggle = !!(analysis || glassAnalysis || stats.inventoryByCountryCdv?.length || stats.inventoryByCountryDl?.length);
  const showSalesSection = brandData.length > 0 || countryData.length > 0;
  const showInvSection = countryInv.length > 0 || brandInv.length > 0;

  return (
    <div>
      <KpiCards
        totalRevenue={totalRevenue}
        totalInventory={totalInventory}
        hasAnalysis={!!analysis}
        cdvValue={stats.cdvInventoryValue}
        dlValue={stats.dlInventoryValue}
        cdvChange={stats.cdvChange}
        dlChange={stats.dlChange}
      />

      <InventoryCharts
        invChangeData={invChangeData}
        inventoryLineData={inventoryLineData}
        invPeriod={invPeriod}
        onPeriodChange={setInvPeriod}
      />

      {showSourceToggle && <SourceToggle source={source} onChange={setSource} />}

      {showSalesSection && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>매출 분석</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
            <PieAnalysisCard title="국가별 매출" data={countryData} total={salesTotalRev} />
            <PieAnalysisCard title="브랜드별 매출" data={brandData} total={salesTotalRev} />
          </div>
        </div>
      )}

      {showInvSection && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>재고 분석</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
            <PieAnalysisCard
              title="국가별 재고"
              data={countryInv.map(x => ({ name: x.name, revenue: x.value }))}
              total={countryInvTotal}
              label="재고가액"
            />
            <PieAnalysisCard
              title="브랜드별 재고"
              data={brandInv.map(x => ({ name: x.name, revenue: x.value }))}
              total={brandInvTotal}
              label="재고가액"
            />
          </div>
        </div>
      )}

      {(showCdvItems || showDlItems) && (
        <div style={{ display: 'grid', gridTemplateColumns: showCdvItems && showDlItems ? 'repeat(auto-fit, minmax(400px, 1fr))' : '1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          {showCdvItems && <InventoryItemsTable items={stats.inventoryByItemCdv!} label="CDV" color="#5A1515" />}
          {showDlItems && <InventoryItemsTable items={stats.inventoryByItemDl!} label="DL" color="#2563eb" />}
        </div>
      )}
    </div>
  );
}
