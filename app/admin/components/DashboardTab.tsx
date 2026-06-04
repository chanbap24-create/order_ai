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
import { Section } from '@/app/components/ui';
import { inputStyle, selectStyle, labelStyle } from '@/app/styles/controls';
import { PRESETS, matchPreset, thisYear } from '@/app/lib/dateRangePresets';

export default function DashboardTab() {
  const defaults = thisYear();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const { stats, analysis, glassAnalysis, loading } = useDashboardData(startDate, endDate);
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

  const activePreset = matchPreset({ startDate, endDate });
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      const r = p.fn();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Section padding="sm">
          <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '0 1 150px', minWidth: 140 }}>
              <label style={labelStyle}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 140 }}>
              <label style={labelStyle}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '0 1 180px', minWidth: 160 }}>
              <label style={labelStyle}>빠른 범위</label>
              <select
                value={activePreset ?? ''}
                onChange={(e) => applyPreset(e.target.value)}
                style={selectStyle}
              >
                <option value="">직접 입력</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>
      </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: showCdvItems && showDlItems ? 'repeat(auto-fit, minmax(400px, 1fr))' : '1fr', gap: 12, marginBottom: 16 }}>
          {showCdvItems && <InventoryItemsTable items={stats.inventoryByItemCdv!} label="까브드뱅" color="var(--action)" />}
          {showDlItems && <InventoryItemsTable items={stats.inventoryByItemDl!} label="대유라이프" color="var(--status-info)" />}
        </div>
      )}
    </div>
  );
}
