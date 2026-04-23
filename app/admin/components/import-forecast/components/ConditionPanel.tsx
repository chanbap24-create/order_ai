"use client";

import type { BrandListItem } from "../types";
import { ConditionPanelHeader } from "./ConditionPanelHeader";
import { ConditionFilterGrid } from "./ConditionFilterGrid";
import { ConditionFilterOptions } from "./ConditionFilterOptions";
import { ConditionRanges } from "./ConditionRanges";

type Props = {
  country: string;
  setCountry: (v: string) => void;
  regionLabel: string;
  onRegionChange: (label: string) => void;
  subRegionLabel: string;
  onSubRegionChange: (label: string) => void;
  wineType: string;
  setWineType: (v: string) => void;
  brand: string;
  brandInput: string;
  setBrand: (v: string) => void;
  setBrandInput: (v: string) => void;
  brandList: BrandListItem[];
  priceMin: string;
  priceMax: string;
  setPriceMin: (v: string) => void;
  setPriceMax: (v: string) => void;
  setPricePreset: (min: number, max: number) => void;
  startYear: string;
  endYear: string;
  setStartYear: (v: string) => void;
  setEndYear: (v: string) => void;
  setYearPreset: (sy: number, ey: number) => void;
  isNewItem: boolean;
  setIsNewItem: (v: boolean) => void;
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
  hasResults: boolean;
  loading: boolean;
  onCalculate: () => void;
  onExportExcel: () => void;
};

export function ConditionPanel(p: Props) {
  const canCalc = !!(p.country || p.brand);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e8e8e8",
        marginBottom: 24,
      }}
    >
      <ConditionPanelHeader
        isNewItem={p.isNewItem}
        setIsNewItem={p.setIsNewItem}
        resetResults={p.resetResults}
        hasResults={p.hasResults}
        loading={p.loading}
        canCalc={canCalc}
        onCalculate={p.onCalculate}
        onExportExcel={p.onExportExcel}
      />

      <div style={{ padding: "16px 24px 20px" }}>
        <ConditionFilterGrid
          country={p.country}
          setCountry={p.setCountry}
          regionLabel={p.regionLabel}
          onRegionChange={p.onRegionChange}
          subRegionLabel={p.subRegionLabel}
          onSubRegionChange={p.onSubRegionChange}
          wineType={p.wineType}
          setWineType={p.setWineType}
          brand={p.brand}
          brandInput={p.brandInput}
          setBrand={p.setBrand}
          setBrandInput={p.setBrandInput}
          brandList={p.brandList}
          resetResults={p.resetResults}
        />

        <div style={{ height: 1, background: "#eee", margin: "0 0 16px" }} />

        <ConditionFilterOptions
          excludeBulk={p.excludeBulk}
          setExcludeBulk={p.setExcludeBulk}
          bulkThreshold={p.bulkThreshold}
          setBulkThreshold={p.setBulkThreshold}
          excludeSamples={p.excludeSamples}
          setExcludeSamples={p.setExcludeSamples}
          noCorrection={p.noCorrection}
          setNoCorrection={p.setNoCorrection}
          businessTypes={p.businessTypes}
          excludedBizTypes={p.excludedBizTypes}
          setExcludedBizTypes={p.setExcludedBizTypes}
          bizTypeOpen={p.bizTypeOpen}
          setBizTypeOpen={p.setBizTypeOpen}
          resetResults={p.resetResults}
        />

        <ConditionRanges
          priceMin={p.priceMin}
          priceMax={p.priceMax}
          setPriceMin={p.setPriceMin}
          setPriceMax={p.setPriceMax}
          setPricePreset={p.setPricePreset}
          startYear={p.startYear}
          endYear={p.endYear}
          setStartYear={p.setStartYear}
          setEndYear={p.setEndYear}
          setYearPreset={p.setYearPreset}
          resetResults={p.resetResults}
        />
      </div>

      {(p.country || p.priceMin) && (
        <div
          style={{
            padding: "10px 24px",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 11,
            color: "#999",
          }}
        >
          {p.isNewItem ? "신규" : "기존"}
          {p.country && (
            <>
              {" "}· {p.country}
              {p.regionLabel ? ` ${p.regionLabel}` : ""}
              {p.wineType ? ` ${p.wineType}` : ""}
            </>
          )}
          {p.priceMin && p.priceMax && (
            <>
              {" "}· {Number(p.priceMin).toLocaleString()}~{Number(p.priceMax).toLocaleString()}원
            </>
          )}
          <> · {p.startYear}~{p.endYear}</>
        </div>
      )}
    </div>
  );
}
