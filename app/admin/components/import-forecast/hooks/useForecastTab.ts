import { useEffect, useState } from "react";
import type {
  BrandListItem,
  BulkInfo,
  DetailTab,
  ExcludedWine,
  LearningCurve,
  ManagerStat,
  PriceStats,
  SampleInfo,
  StockoutInfo,
  TrendData,
  WineShipment,
} from "../types";
import { CY, DEFAULT_BUSINESS_TYPES, REGIONS, SUB_REGIONS } from "../constants";

/**
 * ImportForecastTab의 모든 state + handlers 집약.
 * 페이지 파일은 이 훅 + JSX만 유지하도록 분리.
 */
export function useForecastTab() {
  // 조건
  const [country, setCountry] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [subRegionLabel, setSubRegionLabel] = useState("");
  const [wineType, setWineType] = useState("");
  const [brand, setBrand] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [brandList, setBrandList] = useState<BrandListItem[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [startYear, setStartYear] = useState(String(CY - 1));
  const [endYear, setEndYear] = useState(String(CY - 1));
  const [isNewItem, setIsNewItem] = useState(false);
  const [noCorrection, setNoCorrection] = useState(false);
  const [excludeBulk, setExcludeBulk] = useState(false);
  const [bulkThreshold, setBulkThreshold] = useState(60);
  const [excludeSamples, setExcludeSamples] = useState(true);
  const [businessTypes, setBusinessTypes] = useState<string[]>(DEFAULT_BUSINESS_TYPES);
  const [excludedBizTypes, setExcludedBizTypes] = useState<Set<string>>(new Set());
  const [bizTypeOpen, setBizTypeOpen] = useState(false);

  // 결과
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ManagerStat[] | null>(null);
  const [message, setMessage] = useState("");
  const [matchedItems, setMatchedItems] = useState(0);
  const [allMatchedItems, setAllMatchedItems] = useState(0);
  const [stockoutInfo, setStockoutInfo] = useState<StockoutInfo | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [learningCurve, setLearningCurve] = useState<LearningCurve | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<{ month: string; qty: number; amount: number }[]>([]);
  const [yearlySeries, setYearlySeries] = useState<{ year: string; qty: number; amount: number }[]>([]);
  const [bulkInfo, setBulkInfo] = useState<BulkInfo | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sampleInfo, setSampleInfo] = useState<SampleInfo | null>(null);
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);

  // 상세
  const [activeManager, setActiveManager] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("wines");
  const [expandedWine, setExpandedWine] = useState<string | null>(null);
  const [wineShipments, setWineShipments] = useState<WineShipment[]>([]);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipShowAll, setShipShowAll] = useState(false);
  const [excludedWines, setExcludedWines] = useState<Set<string>>(new Set());
  const [excludedWineDetails, setExcludedWineDetails] = useState<ExcludedWine[]>([]);
  const [pendingRecalc, setPendingRecalc] = useState(false);

  // 브랜드 목록 로드 (1회)
  useEffect(() => {
    fetch("/api/forecast/brands/list")
      .then((r) => r.json())
      .then((d) => setBrandList(d.brands || []))
      .catch(() => {});
  }, []);

  const resetResults = () => {
    setResults(null);
    setExcludedWines(new Set());
    setExcludedWineDetails([]);
    setPendingRecalc(false);
  };

  const handleRegionChange = (label: string) => {
    setRegionLabel(label);
    setSubRegionLabel("");
    const found = (REGIONS[country] || []).find((r) => r.label === label);
    setRegionSearch(found?.search || "");
    resetResults();
  };

  const handleSubRegionChange = (label: string) => {
    setSubRegionLabel(label);
    if (label) {
      const found = (SUB_REGIONS[country]?.[regionLabel] || []).find((r) => r.label === label);
      if (found) setRegionSearch(found.search);
    } else {
      const found = (REGIONS[country] || []).find((r) => r.label === regionLabel);
      setRegionSearch(found?.search || "");
    }
    resetResults();
  };

  const setPricePreset = (min: number, max: number) => {
    setPriceMin(String(min));
    setPriceMax(String(max));
    resetResults();
  };

  const setYearPreset = (sy: number, ey: number) => {
    setStartYear(String(sy));
    setEndYear(String(ey));
    resetResults();
  };

  const toggleExcludeWine = (
    wineName: string,
    wineInfo?: { supply_price: number; region: string | null },
  ) => {
    setExcludedWines((prev) => {
      const next = new Set(prev);
      if (next.has(wineName)) {
        next.delete(wineName);
        setExcludedWineDetails((d) => d.filter((w) => w.item_name !== wineName));
      } else {
        next.add(wineName);
        if (wineInfo) {
          setExcludedWineDetails((d) =>
            d.some((w) => w.item_name === wineName)
              ? d
              : [
                  ...d,
                  {
                    item_name: wineName,
                    supply_price: wineInfo.supply_price,
                    region: wineInfo.region,
                  },
                ],
          );
        }
      }
      return next;
    });
    setPendingRecalc(true);
  };

  const doFetch = async (excludeNames: string[], bulk?: boolean) => {
    if (!country && !brand) return;
    const useBulk = bulk !== undefined ? bulk : excludeBulk;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: country || null,
          regionSearch: regionSearch || null,
          isSubRegion: !!subRegionLabel,
          wineType: wineType || null,
          brand: brand || null,
          priceMin: Number(priceMin) || 0,
          priceMax: Number(priceMax) || 999999999,
          startYear: Number(startYear),
          endYear: Number(endYear),
          isNewItem,
          excludeWineNames: excludeNames,
          excludeBulkSales: useBulk,
          bulkThreshold,
          excludeSamples,
          noCorrection,
          excludeBusinessTypes: [...excludedBizTypes],
        }),
      });
      const data = await res.json();
      setResults(data.stats || []);
      setMessage(data.message || "");
      setMatchedItems(data.matchedItems || 0);
      setAllMatchedItems(data.allMatchedItems || data.matchedItems || 0);
      setStockoutInfo(data.stockoutInfo || null);
      const now = new Date();
      const kstYear = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
      ).getFullYear();
      const trendYear = Math.min(Number(endYear), kstYear - 1);
      fetch(`/api/forecast/trends?endYear=${trendYear}`)
        .then((r) => r.json())
        .then((d) => setTrend(d))
        .catch(() => setTrend(null));
      setBulkInfo(data.bulkInfo || null);
      setSampleInfo(data.sampleInfo || null);
      if (data.businessTypes?.length) setBusinessTypes(data.businessTypes);
      setPriceStats(data.priceStats || null);
      setLearningCurve(data.learningCurve || null);
      setMonthlySeries(data.monthlySeries || []);
      setYearlySeries(data.yearlySeries || []);
      if (data.excludedWines?.length) setExcludedWineDetails(data.excludedWines);
      if (data.stats?.length > 0) {
        setActiveManager((prev) => {
          if (prev === "__all__") return "__all__";
          const names = data.stats.map((s: ManagerStat) => s.manager);
          return prev && names.includes(prev) ? prev : "__all__";
        });
      }
      setPendingRecalc(false);
    } catch {
      setMessage("계산 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => {
    setExcludedWines(new Set());
    setExcludedWineDetails([]);
    setPendingRecalc(false);
    setActiveManager("__all__");
    doFetch([]);
  };

  const handleRecalc = () => doFetch([...excludedWines]);

  const handleWineClick = async (wineName: string, itemCodes: string) => {
    if (expandedWine === wineName) {
      setExpandedWine(null);
      return;
    }
    setExpandedWine(wineName);
    setShipLoading(true);
    setShipShowAll(false);
    setWineShipments([]);
    try {
      const codes = itemCodes.split(", ").map((c) => c.trim());
      const res = await fetch("/api/forecast/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCodes: codes,
          startDate: `${startYear}-01-01`,
          endDate: `${endYear}-12-31`,
          manager: activeManager,
        }),
      });
      const data = await res.json();
      setWineShipments(data.shipments || []);
    } catch {
      setWineShipments([]);
    } finally {
      setShipLoading(false);
    }
  };

  return {
    // 조건
    country, setCountry,
    regionLabel, handleRegionChange,
    subRegionLabel, handleSubRegionChange,
    wineType, setWineType,
    brand, setBrand, brandInput, setBrandInput, brandList,
    priceMin, setPriceMin, priceMax, setPriceMax, setPricePreset,
    startYear, setStartYear, endYear, setEndYear, setYearPreset,
    isNewItem, setIsNewItem,
    noCorrection, setNoCorrection,
    excludeBulk, setExcludeBulk,
    bulkThreshold, setBulkThreshold,
    excludeSamples, setExcludeSamples,
    businessTypes, excludedBizTypes, setExcludedBizTypes,
    bizTypeOpen, setBizTypeOpen,
    resetResults,
    // 결과
    loading, results, message,
    matchedItems, allMatchedItems,
    stockoutInfo, trend, learningCurve,
    monthlySeries, yearlySeries,
    bulkInfo, bulkOpen, setBulkOpen,
    sampleInfo, priceStats,
    handleCalculate, handleRecalc,
    // 상세
    activeManager, setActiveManager,
    detailTab, setDetailTab,
    expandedWine, handleWineClick,
    wineShipments, shipLoading, shipShowAll, setShipShowAll,
    excludedWines, setExcludedWines,
    excludedWineDetails, setExcludedWineDetails,
    toggleExcludeWine, pendingRecalc, setPendingRecalc,
  };
}
