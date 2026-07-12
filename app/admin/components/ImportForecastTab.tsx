'use client';

import MonthlyCompareChart from './MonthlyCompareChart';
import { useForecastTab } from './import-forecast/hooks/useForecastTab';
import { computeForecastTotals, mergeManagerStats } from './import-forecast/lib/mergeStats';
import { exportForecastExcel } from './import-forecast/lib/forecastExcel';
import { ConditionPanel } from './import-forecast/components/ConditionPanel';
import { RecalcBar } from './import-forecast/components/RecalcBar';
import { ResultsSummaryHeader } from './import-forecast/components/ResultsSummaryHeader';
import { CorrectionInfoBar } from './import-forecast/components/CorrectionInfoBar';
import { TrendBar } from './import-forecast/components/TrendBar';
import { ManagerSelector } from './import-forecast/components/ManagerSelector';
import { ManagerDetailCard } from './import-forecast/components/ManagerDetailCard';
import { SimulationCard } from './import-forecast/components/SimulationCard';
import { BrandVelocitySection } from './import-forecast/components/BrandVelocitySection';

export default function ImportForecastTab() {
  const s = useForecastTab();

  // 계산
  const totals = computeForecastTotals(s.results);
  const { totalRaw, totalCorrected, totalYear1, totalClients } = totals;
  const displayTotal = s.isNewItem ? totalYear1 : totalCorrected;
  const totalCases = Math.ceil(displayTotal / 12);
  const correctionPct = totalRaw > 0 ? Math.round(((totalCorrected - totalRaw) / totalRaw) * 100) : 0;
  const mergedData = mergeManagerStats(s.results, totals, s.isNewItem);
  const activeData =
    s.activeManager === '__all__'
      ? mergedData
      : s.results?.find((r) => r.manager === s.activeManager) || null;

  const handleExportExcel = async () => {
    if (!s.results || s.results.length === 0 || !mergedData) return;
    await exportForecastExcel({
      results: s.results,
      mergedData,
      isNewItem: s.isNewItem,
      country: s.country,
      regionLabel: s.regionLabel,
      wineType: s.wineType,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      startYear: s.startYear,
      endYear: s.endYear,
      stockoutInfo: s.stockoutInfo,
      learningCurve: s.learningCurve,
      priceStats: s.priceStats,
      totals: { totalCorrected, totalYear1, totalClients },
    });
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <ConditionPanel
        country={s.country} setCountry={s.setCountry}
        regionLabel={s.regionLabel} onRegionChange={s.handleRegionChange}
        subRegionLabel={s.subRegionLabel} onSubRegionChange={s.handleSubRegionChange}
        wineType={s.wineType} setWineType={s.setWineType}
        brand={s.brand} brandInput={s.brandInput} setBrand={s.setBrand} setBrandInput={s.setBrandInput} brandList={s.brandList}
        priceMin={s.priceMin} priceMax={s.priceMax} setPriceMin={s.setPriceMin} setPriceMax={s.setPriceMax} setPricePreset={s.setPricePreset}
        startYear={s.startYear} endYear={s.endYear} setStartYear={s.setStartYear} setEndYear={s.setEndYear} setYearPreset={s.setYearPreset}
        isNewItem={s.isNewItem} setIsNewItem={s.setIsNewItem}
        excludeBulk={s.excludeBulk} setExcludeBulk={s.setExcludeBulk}
        bulkThreshold={s.bulkThreshold} setBulkThreshold={s.setBulkThreshold}
        excludeSamples={s.excludeSamples} setExcludeSamples={s.setExcludeSamples}
        noCorrection={s.noCorrection} setNoCorrection={s.setNoCorrection}
        businessTypes={s.businessTypes}
        excludedBizTypes={s.excludedBizTypes} setExcludedBizTypes={s.setExcludedBizTypes}
        bizTypeOpen={s.bizTypeOpen} setBizTypeOpen={s.setBizTypeOpen}
        resetResults={s.resetResults}
        hasResults={!!s.results && s.results.length > 0}
        loading={s.loading}
        onCalculate={s.handleCalculate}
        onExportExcel={handleExportExcel}
      />

      {s.message && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92750c', marginBottom: 16, border: '1px solid #fde68a', lineHeight: 1.5 }}>
          {s.message}
        </div>
      )}

      <RecalcBar
        visible={s.pendingRecalc && s.excludedWines.size > 0 && s.results !== null}
        excludedCount={s.excludedWines.size}
        loading={s.loading}
        onReset={() => {
          s.setExcludedWines(new Set());
          s.setExcludedWineDetails([]);
          s.setPendingRecalc(false);
        }}
        onRecalc={s.handleRecalc}
      />

      {s.results !== null && s.results.length > 0 && (
        <>
          <ResultsSummaryHeader
            isNewItem={s.isNewItem}
            country={s.country} regionLabel={s.regionLabel} wineType={s.wineType}
            priceMin={s.priceMin} priceMax={s.priceMax}
            startYear={s.startYear} endYear={s.endYear}
            matchedItems={s.matchedItems} allMatchedItems={s.allMatchedItems}
            displayTotal={displayTotal} totalCases={totalCases}
            totalClients={totalClients} totalCorrected={totalCorrected}
          />

          {s.monthlySeries.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--border-default)', padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 12 }}>월별 판매 추이 (빈티지 통합)</div>
              <MonthlyCompareChart data={s.monthlySeries} yearly={s.yearlySeries} startYear={s.startYear} endYear={s.endYear} />
            </div>
          )}

          <CorrectionInfoBar
            stockoutInfo={s.stockoutInfo}
            correctionPct={correctionPct}
            isNewItem={s.isNewItem}
            learningCurve={s.learningCurve}
            activeData={activeData}
            bulkInfo={s.bulkInfo}
            bulkOpen={s.bulkOpen}
            setBulkOpen={s.setBulkOpen}
            sampleInfo={s.sampleInfo}
            priceStats={s.priceStats}
          />

          <TrendBar trend={s.trend} mergedData={mergedData} results={s.results} country={s.country} wineType={s.wineType} />

          <ManagerSelector
            results={s.results}
            activeManager={s.activeManager}
            setActiveManager={s.setActiveManager}
            setDetailTab={s.setDetailTab}
            isNewItem={s.isNewItem}
            displayTotal={displayTotal}
            totalClients={totalClients}
          />

          {activeData && (
            <ManagerDetailCard
              activeData={activeData}
              detailTab={s.detailTab} setDetailTab={s.setDetailTab}
              isNewItem={s.isNewItem} learningCurve={s.learningCurve}
              excludedWines={s.excludedWines} setExcludedWines={s.setExcludedWines}
              excludedWineDetails={s.excludedWineDetails} setExcludedWineDetails={s.setExcludedWineDetails}
              toggleExcludeWine={s.toggleExcludeWine}
              setPendingRecalc={s.setPendingRecalc}
              expandedWine={s.expandedWine}
              onWineClick={s.handleWineClick}
              wineShipments={s.wineShipments}
              shipLoading={s.shipLoading}
              shipShowAll={s.shipShowAll}
              setShipShowAll={s.setShipShowAll}
            />
          )}

          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--neutral-100)', lineHeight: 1.8 }}>
            {s.startYear}~{s.endYear} · {Number(s.priceMin).toLocaleString()}~{Number(s.priceMax).toLocaleString()}원 · {s.matchedItems}개 품목.
            {s.stockoutInfo && s.stockoutInfo.correctedWines > 0 && (
              <> 품절보정 {s.stockoutInfo.correctedWines}개 ×{s.stockoutInfo.avgFactor}.</>
            )}
            {s.isNewItem && s.learningCurve && (
              <> 러닝커브 {Math.round(s.learningCurve.ratio * 100)}% ({s.learningCurve.sampleSize}개 기반).</>
            )}
          </div>
        </>
      )}

      {s.results !== null && s.results.length === 0 && !s.message && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--neutral-100)', fontSize: 13, background: 'var(--gray-50)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
          해당 조건의 판매 이력이 없습니다.<br /><span style={{ fontSize: 11 }}>조건을 조정해 보세요.</span>
        </div>
      )}

      <SimulationCard
        mergedData={mergedData}
        results={s.results || []}
        isNewItem={s.isNewItem}
        learningCurve={s.learningCurve}
        priceStats={s.priceStats}
      />

      <BrandVelocitySection startYear={s.startYear} endYear={s.endYear} />
    </div>
  );
}
