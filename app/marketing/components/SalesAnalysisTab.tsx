'use client';

import { useEffect, useState } from 'react';
import type { ViewMode } from '../sales-analysis/types';
import { useSalesAnalysis } from '../sales-analysis/hooks/useSalesAnalysis';
import { FilterPanel } from '../sales-analysis/components/FilterPanel';
import { KpiCards } from '../sales-analysis/components/KpiCards';
import { TypeDistribution } from '../sales-analysis/components/TypeDistribution';
import { CountrySummary } from '../sales-analysis/components/CountrySummary';
import { TopItemsTable } from '../sales-analysis/components/TopItemsTable';
import { MonthlyTrend } from '../sales-analysis/components/MonthlyTrend';

export default function SalesAnalysisTab() {
  const s = useSalesAnalysis();
  const [view, setView] = useState<ViewMode>('summary');
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [itemShowAll, setItemShowAll] = useState(false);

  useEffect(() => {
    if (s.data) { setView('summary'); setExpandedCountry(null); }
  }, [s.data]);

  return (
    <div>
      <FilterPanel
        options={s.options}
        availableRegions={s.availableRegions}
        availableSubRegions={s.availableSubRegions}
        startDate={s.startDate} endDate={s.endDate}
        country={s.country} region={s.region} subRegion={s.subRegion}
        wineType={s.wineType} brand={s.brand}
        onStartDate={s.setStartDate} onEndDate={s.setEndDate}
        onCountry={s.setCountry} onRegion={s.setRegion} onSubRegion={s.setSubRegion}
        onWineType={s.setWineType} onBrand={s.setBrand}
        loading={s.loading}
        onSearch={() => { setItemShowAll(false); s.handleSearch(); }}
        quickRanges={s.quickRanges}
      />

      {s.searched && s.data && s.data.total_qty > 0 && (
        <>
          <KpiCards data={s.data} />
          <TypeDistribution data={s.data} />

          <div style={{
            display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)',
            borderRadius: 8, padding: 2, marginBottom: 12, width: 'fit-content',
          }}>
            {([
              ['summary', '국가/지역'],
              ['items', `품목별 ${s.data.top_items.length}`],
              ['trend', '월별 추이'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: view === v ? 700 : 500,
                  background: view === v ? '#fff' : 'transparent',
                  color: view === v ? 'var(--action)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'summary' && (
            <CountrySummary
              data={s.data}
              expandedCountry={expandedCountry}
              onToggleCountry={(name) =>
                setExpandedCountry(prev => prev === name ? null : name)
              }
            />
          )}

          {view === 'items' && s.data.top_items && (
            <TopItemsTable
              items={s.data.top_items}
              showAll={itemShowAll}
              onToggleShowAll={() => setItemShowAll(v => !v)}
            />
          )}

          {view === 'trend' && s.data.monthly && <MonthlyTrend data={s.data} />}
        </>
      )}

      {s.searched && !s.loading && s.data && s.data.total_qty === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          해당 조건에 맞는 판매 데이터가 없습니다.
        </div>
      )}

      {!s.searched && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13,
          border: '1px solid rgba(90,21,21,0.06)', lineHeight: 1.8,
        }}>
          기간과 조건을 설정한 후 <strong style={{ color: 'var(--action)' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}
