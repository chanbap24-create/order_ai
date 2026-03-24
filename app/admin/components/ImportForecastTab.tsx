'use client';

import { useState, useRef, useEffect } from 'react';
import MonthlyCompareChart from './MonthlyCompareChart';

interface YearDetail { year: string; qty: number; correctedQty: number; items: number; clients: number; qtyPerItem: number; qtyPerItemCorrected: number; }
interface WineDetail { item_code: string; item_name: string; supply_price: number; avg_import_cost: number; avg_selling_price: number; region: string | null; total_qty: number; corrected_qty: number; stockout_factor: number; client_count: number; years_sold: number; annual_avg: number; annual_avg_corrected: number; }
interface TopClient { client_name: string; total_qty: number; item_count: number; business_type?: string; }
interface WineDistribution { median: number; p25: number; p75: number; count: number; }
interface ChannelStat { channel: string; qty: number; annual_qty: number; clients: number; wines: number; qty_per_wine: number; pct: number; }
interface ManagerStat {
  manager: string; years_active: number; avg_annual_qty: number; avg_annual_qty_corrected: number; avg_items: number;
  qty_per_item_raw: number; qty_per_item: number; qty_per_item_year1: number | null;
  avg_clients: number; min_qty: number; max_qty: number;
  wine_distribution: WineDistribution;
  channels?: ChannelStat[];
  year_details?: YearDetail[]; wine_details?: WineDetail[]; top_clients?: TopClient[];
}
interface ExcludedWine { item_name: string; supply_price: number; region: string | null; }
interface StockoutInfo { correctedWines: number; totalWines: number; avgFactor: number; }
interface BulkDetail { date: string; client: string; wine: string; qty: number; manager: string; }
interface BulkInfo { excluded: number; qty: number; threshold: number; details: BulkDetail[]; }
interface SampleInfo { excluded: number; qty: number; }
interface PriceStats { avg: number; min: number; max: number; }
interface LearningCurve { ratio: number; sampleSize: number; details: { name: string; year1: number; mature: number; ratio: number }[]; }

const COUNTRIES = ['프랑스','이탈리아','칠레','포르투갈','호주','미국','뉴질랜드','스페인','아르헨티나','독일'];

const REGIONS: Record<string, { label: string; search: string }[]> = {
  '프랑스': [
    { label: '보르도', search: 'Médoc,Graves,Right Bank,Sauternes,보르도' }, { label: '부르고뉴', search: 'Bourgogne,Chablis,Nuits,Beaune,Chalonnaise,Mâconnais,Régionale' },
    { label: '론', search: 'Rhône,Northern Rhône,Southern Rhône' }, { label: '샴페인', search: 'Champagne' },
    { label: '알자스', search: 'Alsace' }, { label: '루아르', search: 'Loire' },
    { label: '랑그독', search: 'Languedoc' }, { label: '프로방스', search: 'Provence' },
    { label: '샤블리', search: 'Chablis' }, { label: '보졸레', search: 'Beaujolais' },
  ],
  '이탈리아': [
    { label: '토스카나', search: 'Toscan,Tuscan' }, { label: '피에몬테', search: 'Piemont,Piedmont' },
    { label: '베네토', search: 'Veneto' }, { label: '시칠리아', search: 'Sicil' },
    { label: '풀리아', search: 'Puglia' }, { label: '캄파니아', search: 'Campania' },
  ],
  '칠레': [
    { label: '마이포', search: 'Maipo' }, { label: '콜차구아', search: 'Colchagua' },
    { label: '카사블랑카', search: 'Casablanca' }, { label: '라펠', search: 'Rapel' },
    { label: '아콩카과', search: 'Aconcagua' }, { label: '레이다', search: 'Leyda' },
  ],
  '포르투갈': [
    { label: '도우로', search: 'Douro' }, { label: '알렌테주', search: 'Alentejo' },
    { label: '다옹', search: 'Dao,Dão' }, { label: '마데이라', search: 'Madeira' },
  ],
  '호주': [
    { label: '바로사', search: 'Barossa' }, { label: '맥라렌 베일', search: 'McLaren' },
    { label: '마가렛 리버', search: 'Margaret' }, { label: '헌터 밸리', search: 'Hunter' },
    { label: '야라 밸리', search: 'Yarra' },
  ],
  '미국': [
    { label: '나파 밸리', search: 'Napa' }, { label: '소노마', search: 'Sonoma' },
    { label: '워싱턴', search: 'Washington' }, { label: '오레곤', search: 'Oregon' },
    { label: '캘리포니아', search: 'California' },
  ],
  '뉴질랜드': [
    { label: '말보로', search: 'Marlborough' }, { label: '혹스 베이', search: 'Hawke' },
    { label: '센트럴 오타고', search: 'Otago' },
  ],
  '스페인': [
    { label: '리오하', search: 'Rioja' }, { label: '리베라 델 두에로', search: 'Ribera' },
    { label: '프리오랏', search: 'Priorat' }, { label: '페네데스', search: 'Penedes' },
  ],
  '아르헨티나': [
    { label: '멘도사', search: 'Mendoza' }, { label: '우코 밸리', search: 'Uco' },
  ],
  '독일': [
    { label: '모젤', search: 'Mosel' }, { label: '라인가우', search: 'Rheingau' },
    { label: '팔츠', search: 'Pfalz' },
  ],
};

const SUB_REGIONS: Record<string, Record<string, { label: string; search: string }[]>> = {
  '프랑스': {
    '부르고뉴': [
      { label: '샤블리', search: 'Chablis' },
      { label: '코트 드 뉘', search: 'Nuits,Gevrey,Chambertin,Chambolle,Musigny,Vosne,Romanee,Romanée,Fixin,Marsannay,Clos de Vougeot,Nuits St' },
      { label: '코트 드 본', search: 'Beaune,Meursault,Mersault,Puligny,Chassagne,Volnay,Pommard,Corton,Aloxe,Montrachet,Monthelie,Auxey,Saint Aubin,Chorey,Savigny,Santenay,Blagny' },
      { label: '보졸레', search: 'Beaujolais' },
      { label: '마코네', search: 'Mâconnais,Maconnais,Macon' },
    ],
    '보르도': [
      { label: '메독', search: 'Médoc,Medoc,Margaux,Pauillac,Saint-Julien,Saint-Estephe,Haut-Médoc' },
      { label: '우안', search: 'Saint-Emilion,Saint Emilion,Pomerol' },
      { label: '그라브/소테른', search: 'Graves,Sauternes,Pessac,Barsac' },
    ],
    '론': [
      { label: '북부 론', search: 'Northern Rhône,Condrieu,Hermitage,Cornas,Saint Joseph,Cote Rotie,Côte-Rôtie' },
      { label: '남부 론', search: 'Southern Rhône,Chateauneuf,Châteauneuf,Gigondas,Vacqueyras,Luberon,Ventoux' },
    ],
  },
  '이탈리아': {
    '토스카나': [
      { label: '키안티', search: 'Chianti' },
      { label: '볼게리', search: 'Bolgheri' },
      { label: '몬탈치노', search: 'Montalcino' },
    ],
    '피에몬테': [
      { label: '바롤로', search: 'Barolo' },
      { label: '바르바레스코', search: 'Barbaresco' },
    ],
  },
};

const PRICE_PRESETS = [
  { label: '~1만', min: 0, max: 10000 },
  { label: '1~2만', min: 10000, max: 20000 },
  { label: '2~3만', min: 20000, max: 30000 },
  { label: '3~5만', min: 30000, max: 50000 },
  { label: '5~10만', min: 50000, max: 100000 },
  { label: '10만~', min: 100000, max: 999999999 },
];

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2019 }, (_, i) => 2020 + i);

const YEAR_PRESETS = [
  { label: '작년', start: CY - 1, end: CY - 1 },
  { label: '올해', start: CY, end: CY },
  { label: '최근 2년', start: CY - 1, end: CY },
  { label: '최근 3년', start: CY - 2, end: CY },
  { label: '최근 4년', start: CY - 3, end: CY },
  { label: '전체', start: 2020, end: CY },
];

export default function ImportForecastTab() {
  const [country, setCountry] = useState('');
  const [regionLabel, setRegionLabel] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [subRegionLabel, setSubRegionLabel] = useState('');
  const [wineType, setWineType] = useState('');
  const [brand, setBrand] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [brandList, setBrandList] = useState<{ name: string; abbr: string; country: string; count: number }[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [startYear, setStartYear] = useState(String(CY - 1));
  const [endYear, setEndYear] = useState(String(CY - 1));
  const [isNewItem, setIsNewItem] = useState(false);
  const [noCorrection, setNoCorrection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ManagerStat[] | null>(null);
  const [priceRange, setPriceRange] = useState<{ label: string } | null>(null);
  const [message, setMessage] = useState('');
  const [matchedItems, setMatchedItems] = useState(0);
  const [stockoutInfo, setStockoutInfo] = useState<StockoutInfo | null>(null);
  const [trend, setTrend] = useState<{ year: string; prevYear: string; items: Record<string, { cur: number; prev: number; pct: number }> } | null>(null);
  const [learningCurve, setLearningCurve] = useState<LearningCurve | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<{ month: string; qty: number }[]>([]);
  const [yearlySeries, setYearlySeries] = useState<{ year: string; qty: number }[]>([]);
  const [activeManager, setActiveManager] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'wines' | 'years' | 'clients' | 'channels'>('wines');
  const [expandedWine, setExpandedWine] = useState<string | null>(null);
  const [wineShipments, setWineShipments] = useState<{ date: string; client: string; qty: number; price: number; manager: string }[]>([]);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipShowAll, setShipShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 스크롤 영역에서 휠 이벤트가 페이지 스크롤로 전파되지 않도록
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (!atTop && !atBottom) {
        e.stopPropagation();
      }
    };
    el.addEventListener('wheel', handler, { passive: true });
    return () => el.removeEventListener('wheel', handler);
  }, [shipShowAll, expandedWine]);
  const [excludedWines, setExcludedWines] = useState<Set<string>>(new Set());
  const [excludedWineDetails, setExcludedWineDetails] = useState<ExcludedWine[]>([]);
  const [pendingRecalc, setPendingRecalc] = useState(false);
  const [allMatchedItems, setAllMatchedItems] = useState(0);
  const [excludeBulk, setExcludeBulk] = useState(true);
  const [bulkThreshold, setBulkThreshold] = useState(60);
  const [bulkInfo, setBulkInfo] = useState<BulkInfo | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [excludeSamples, setExcludeSamples] = useState(true);
  const [sampleInfo, setSampleInfo] = useState<SampleInfo | null>(null);
  const [businessTypes, setBusinessTypes] = useState<string[]>(['etc/기타','off/백화점','off/편의점','off/할인점','on/도매장','on/샵','on/업소','on/호텔','백화점','백화점(와인)','(미분류)']);
  const [excludedBizTypes, setExcludedBizTypes] = useState<Set<string>>(new Set());
  const [bizTypeOpen, setBizTypeOpen] = useState(false);
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);

  const handleRegionChange = (label: string) => {
    setRegionLabel(label);
    setSubRegionLabel('');
    const found = (REGIONS[country] || []).find(r => r.label === label);
    setRegionSearch(found?.search || '');
    setResults(null); setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
  };

  const handleSubRegionChange = (label: string) => {
    setSubRegionLabel(label);
    if (label) {
      const found = (SUB_REGIONS[country]?.[regionLabel] || []).find(r => r.label === label);
      if (found) {
        // 세부 지역 키워드로 regionSearch를 대체
        setRegionSearch(found.search);
      }
    } else {
      // 세부 지역 해제 → 상위 지역 키워드로 복원
      const found = (REGIONS[country] || []).find(r => r.label === regionLabel);
      setRegionSearch(found?.search || '');
    }
    setResults(null); setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
  };

  const availableSubRegions = country && regionLabel ? (SUB_REGIONS[country]?.[regionLabel] || []) : [];

  // 브랜드 목록 로드 (1회)
  useEffect(() => {
    fetch('/api/forecast/brands/list').then(r => r.json()).then(d => setBrandList(d.brands || [])).catch(() => {});
  }, []);

  const setPricePreset = (min: number, max: number) => {
    setPriceMin(String(min)); setPriceMax(String(max)); setResults(null); setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
  };
  const setYearPreset = (sy: number, ey: number) => {
    setStartYear(String(sy)); setEndYear(String(ey)); setResults(null); setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
  };

  const toggleExcludeWine = (wineName: string, wineInfo?: { supply_price: number; region: string | null }) => {
    setExcludedWines(prev => {
      const next = new Set(prev);
      if (next.has(wineName)) {
        next.delete(wineName);
        setExcludedWineDetails(d => d.filter(w => w.item_name !== wineName));
      } else {
        next.add(wineName);
        if (wineInfo) {
          setExcludedWineDetails(d => d.some(w => w.item_name === wineName) ? d : [...d, { item_name: wineName, supply_price: wineInfo.supply_price, region: wineInfo.region }]);
        }
      }
      return next;
    });
    setPendingRecalc(true);
  };

  const doFetch = async (excludeNames: string[], bulk?: boolean) => {
    if (!country && !brand) return;
    const useBulk = bulk !== undefined ? bulk : excludeBulk;
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: country || null, regionSearch: regionSearch || null, isSubRegion: !!subRegionLabel, wineType: wineType || null, brand: brand || null, priceMin: Number(priceMin) || 0, priceMax: Number(priceMax) || 999999999, startYear: Number(startYear), endYear: Number(endYear), isNewItem, excludeWineNames: excludeNames, excludeBulkSales: useBulk, bulkThreshold, excludeSamples, noCorrection, excludeBusinessTypes: [...excludedBizTypes] }),
      });
      const data = await res.json();
      setResults(data.stats || []);
      setPriceRange(data.priceRange || null);
      setMessage(data.message || '');
      setMatchedItems(data.matchedItems || 0);
      setAllMatchedItems(data.allMatchedItems || data.matchedItems || 0);
      setStockoutInfo(data.stockoutInfo || null);
      // 트렌드는 직전 완료 연도 기준 (현재 진행 중인 해는 제외)
      const now = new Date();
      const kstYear = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getFullYear();
      const trendYear = Math.min(Number(endYear), kstYear - 1);
      fetch(`/api/forecast/trends?endYear=${trendYear}`)
        .then(r => r.json()).then(d => setTrend(d)).catch(() => setTrend(null));
      setBulkInfo(data.bulkInfo || null);
      setSampleInfo(data.sampleInfo || null);
      if (data.businessTypes?.length) setBusinessTypes(data.businessTypes);
      setPriceStats(data.priceStats || null);
      setLearningCurve(data.learningCurve || null);
      setMonthlySeries(data.monthlySeries || []);
      setYearlySeries(data.yearlySeries || []);
      if (data.excludedWines?.length) {
        setExcludedWineDetails(data.excludedWines);
      }
      if (data.stats?.length > 0) {
        setActiveManager(prev => {
          if (prev === '__all__') return '__all__';
          const names = data.stats.map((s: ManagerStat) => s.manager);
          return prev && names.includes(prev) ? prev : '__all__';
        });
      }
      setPendingRecalc(false);
    } catch { setMessage('계산 중 오류가 발생했습니다'); }
    finally { setLoading(false); }
  };

  const handleCalculate = () => {
    setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
    setActiveManager('__all__');
    doFetch([]);
  };

  const handleRecalc = () => {
    doFetch([...excludedWines]);
  };

  const handleExportExcel = async () => {
    if (!results || results.length === 0 || !mergedData) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    const burgundy = 'FF5A1515';
    const lightBg = 'FFF9F5F3';
    const borderColor = 'FFE0DBD7';
    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: burgundy } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' };
    const bodyFont: Partial<ExcelJS.Font> = { size: 10, name: 'Arial' };
    const boldFont: Partial<ExcelJS.Font> = { ...bodyFont, bold: true };
    const numFmt = '#,##0';
    const pctFmt = '0.0%';
    const thinBorder: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: borderColor } } };

    const styleHeader = (ws: ExcelJS.Worksheet) => {
      const row = ws.getRow(1);
      const colCount = ws.columns.length;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'medium', color: { argb: burgundy } } };
      }
      row.height = 28;
      ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    };

    const styleBody = (ws: ExcelJS.Worksheet, numCols: number[], pctCols: number[] = []) => {
      ws.eachRow((row, idx) => {
        if (idx <= 1) return;
        for (let c = 1; c <= (ws.columns.length); c++) {
          const cell = row.getCell(c);
          cell.font = bodyFont;
          cell.border = thinBorder;
          if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBg } };
        }
        numCols.forEach(c => { row.getCell(c).numFmt = numFmt; });
        pctCols.forEach(c => { row.getCell(c).numFmt = pctFmt; });
      });
    };

    // ── 시트1: 요약 ──
    const ws1 = wb.addWorksheet('요약');
    ws1.columns = [
      { header: '영업사원', key: 'mgr', width: 14 },
      { header: '활동연수', key: 'years', width: 10 },
      { header: '연평균판매(보정)', key: 'avgQty', width: 18 },
      { header: '평균품목수', key: 'items', width: 12 },
      { header: '기대값(병/년)', key: 'qpi', width: 16 },
      ...(isNewItem ? [{ header: '1년차예상', key: 'y1' as const, width: 14 }] : []),
      { header: '평균거래처', key: 'clients', width: 12 },
      { header: '와인분포(중위)', key: 'median', width: 16 },
    ];
    styleHeader(ws1);

    const allRow: Record<string, unknown> = { mgr: '전체 합계', years: mergedData.years_active, avgQty: mergedData.avg_annual_qty_corrected, items: mergedData.avg_items, qpi: totalCorrected, clients: totalClients, median: mergedData.wine_distribution.median };
    if (isNewItem) allRow.y1 = totalYear1;
    ws1.addRow(allRow);
    const totalRow = ws1.getRow(2);
    for (let c = 1; c <= ws1.columns.length; c++) {
      totalRow.getCell(c).font = { ...boldFont, size: 11, color: { argb: burgundy } };
      totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0ED' } };
      totalRow.getCell(c).border = { bottom: { style: 'medium', color: { argb: burgundy } } };
    }
    totalRow.height = 26;

    for (const r of results) {
      const row: Record<string, unknown> = { mgr: r.manager, years: r.years_active, avgQty: r.avg_annual_qty_corrected, items: r.avg_items, qpi: r.qty_per_item, clients: r.avg_clients, median: r.wine_distribution.median };
      if (isNewItem) row.y1 = r.qty_per_item_year1;
      ws1.addRow(row);
    }
    styleBody(ws1, [3, 5, 6, 7, 8]);

    // 보정 정보
    const infoRow = ws1.rowCount + 2;
    ws1.mergeCells(`A${infoRow}:D${infoRow}`);
    ws1.getCell(`A${infoRow}`).value = '분석 조건';
    ws1.getCell(`A${infoRow}`).font = { ...boldFont, size: 11 };
    ws1.getCell(`A${infoRow}`).border = { bottom: { style: 'medium', color: { argb: burgundy } } };
    const conditions = [
      `${isNewItem ? '신규' : '기존'} · ${country}${regionLabel ? ' · ' + regionLabel : ''}${wineType ? ' · ' + wineType : ''} · ${Number(priceMin).toLocaleString()}~${Number(priceMax).toLocaleString()}원 · ${startYear}~${endYear}`,
      stockoutInfo && stockoutInfo.correctedWines > 0 ? `재고소진 보정: ${stockoutInfo.correctedWines}개 와인, 평균 ×${stockoutInfo.avgFactor}` : '',
      learningCurve ? `러닝커브: ${Math.round(learningCurve.ratio * 100)}% (${learningCurve.sampleSize}개 샘플)` : '',
      priceStats ? `평균공급가: ${priceStats.avg.toLocaleString()}원 (${priceStats.min.toLocaleString()}~${priceStats.max.toLocaleString()})` : '',
    ].filter(Boolean);
    conditions.forEach((txt, i) => {
      ws1.mergeCells(`A${infoRow + 1 + i}:F${infoRow + 1 + i}`);
      ws1.getCell(`A${infoRow + 1 + i}`).value = txt;
      ws1.getCell(`A${infoRow + 1 + i}`).font = { ...bodyFont, color: { argb: 'FF8A8580' } };
    });

    // ── 시트2: 판매와인 ──
    const ws2 = wb.addWorksheet('판매와인');
    ws2.columns = [
      { header: '와인명', key: 'name', width: 36 },
      { header: '품번', key: 'code', width: 16 },
      { header: '지역', key: 'region', width: 20 },
      { header: '공급가', key: 'supply', width: 12 },
      { header: '평균공급가', key: 'avg', width: 13 },
      { header: '할인율', key: 'disc', width: 10 },
      { header: '거래처', key: 'clients', width: 9 },
      { header: '연수', key: 'years', width: 7 },
      { header: '총판매', key: 'total', width: 11 },
      { header: '보정판매', key: 'corrected', width: 11 },
      { header: '연평균(보정)', key: 'annual', width: 13 },
      { header: '품절보정', key: 'factor', width: 10 },
    ];
    styleHeader(ws2);
    for (const w of mergedData.wine_details || []) {
      ws2.addRow({
        name: w.item_name, code: w.item_code, region: w.region || '',
        supply: w.supply_price, avg: w.avg_selling_price,
        disc: w.supply_price > 0 && w.avg_selling_price > 0 ? (w.avg_selling_price - w.supply_price) / w.supply_price : 0,
        clients: w.client_count, years: w.years_sold,
        total: w.total_qty, corrected: w.corrected_qty, annual: w.annual_avg_corrected,
        factor: w.stockout_factor > 1 ? `×${w.stockout_factor}` : '',
      });
    }
    styleBody(ws2, [4, 5, 9, 10, 11], [6]);

    // ── 시트3: 거래처 (전체) ──
    const ws3 = wb.addWorksheet('거래처');
    ws3.columns = [
      { header: '#', key: 'rank', width: 6 },
      { header: '거래처명', key: 'name', width: 32 },
      { header: '업종', key: 'biz', width: 14 },
      { header: '품목수', key: 'items', width: 10 },
      { header: '총구매(병)', key: 'qty', width: 14 },
    ];
    styleHeader(ws3);
    const clientAggAll: Record<string, { qty: number; items: number; biz: string }> = {};
    for (const r of results) {
      for (const c of r.top_clients || []) {
        if (!clientAggAll[c.client_name]) clientAggAll[c.client_name] = { qty: 0, items: 0, biz: c.business_type || '' };
        clientAggAll[c.client_name].qty += c.total_qty;
        clientAggAll[c.client_name].items = Math.max(clientAggAll[c.client_name].items, c.item_count);
      }
    }
    Object.entries(clientAggAll)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .forEach(([name, v], i) => {
        ws3.addRow({ rank: i + 1, name, biz: v.biz, items: v.items, qty: v.qty });
      });
    styleBody(ws3, [5]);

    // ── 시트4: 연도별추이 ──
    const ws4 = wb.addWorksheet('연도별추이');
    ws4.columns = [
      { header: '연도', key: 'year', width: 10 },
      { header: '판매량', key: 'qty', width: 12 },
      { header: '보정판매량', key: 'corrected', width: 14 },
      { header: '와인수', key: 'items', width: 10 },
      { header: '거래처수', key: 'clients', width: 10 },
      { header: '와인당판매(보정)', key: 'perItem', width: 18 },
    ];
    styleHeader(ws4);
    for (const y of mergedData.year_details || []) {
      ws4.addRow({ year: y.year, qty: y.qty, corrected: y.correctedQty, items: y.items, clients: y.clients, perItem: y.qtyPerItemCorrected });
    }
    styleBody(ws4, [2, 3, 6]);

    // ── 시트5: 영업사원별 ──
    const ws5 = wb.addWorksheet('영업사원별 와인');
    ws5.columns = [
      { header: '영업사원', key: 'mgr', width: 12 },
      { header: '와인명', key: 'name', width: 36 },
      { header: '공급가', key: 'supply', width: 12 },
      { header: '평균공급가', key: 'avg', width: 13 },
      { header: '거래처', key: 'clients', width: 9 },
      { header: '총판매', key: 'total', width: 11 },
      { header: '연평균(보정)', key: 'annual', width: 13 },
    ];
    styleHeader(ws5);
    for (const r of results) {
      for (const w of r.wine_details || []) {
        ws5.addRow({ mgr: r.manager, name: w.item_name, supply: w.supply_price, avg: w.avg_selling_price, clients: w.client_count, total: w.total_qty, annual: w.annual_avg_corrected });
      }
    }
    styleBody(ws5, [3, 4, 6, 7]);

    // ── 시트6: 출고이력 ──
    const ws6 = wb.addWorksheet('출고이력');
    ws6.columns = [
      { header: '와인명', key: 'wine', width: 36 },
      { header: '날짜', key: 'date', width: 12 },
      { header: '거래처', key: 'client', width: 28 },
      { header: '공급가', key: 'price', width: 12 },
      { header: '수량', key: 'qty', width: 8 },
      { header: '담당', key: 'manager', width: 10 },
    ];
    styleHeader(ws6);

    // 와인 item_code → 와인명 역매핑
    const codeToName: Record<string, string> = {};
    for (const w of mergedData.wine_details || []) {
      for (const c of w.item_code.split(', ')) codeToName[c.trim()] = w.item_name;
    }
    const allCodes = Object.keys(codeToName);
    const shipRows: { wine: string; date: string; client: string; price: number; qty: number; manager: string }[] = [];
    for (let i = 0; i < allCodes.length; i += 100) {
      const chunk = allCodes.slice(i, i + 100);
      try {
        const res = await fetch('/api/forecast/detail', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemCodes: chunk, startDate: `${startYear}-01-01`, endDate: `${endYear}-12-31` }),
        });
        const data = await res.json();
        for (const s of data.shipments || []) {
          shipRows.push({ wine: codeToName[s.item_no] || s.item_no || '', date: s.date, client: s.client, price: s.price, qty: s.qty, manager: s.manager });
        }
      } catch { /* skip */ }
    }
    shipRows.sort((a, b) => a.wine.localeCompare(b.wine) || b.date.localeCompare(a.date));
    for (const r of shipRows) ws6.addRow(r);
    styleBody(ws6, [4, 5]);

    // ── 다운로드 ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `수입량예측_${country}${regionLabel ? '_' + regionLabel : ''}_${startYear}-${endYear}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWineClick = async (wineName: string, itemCodes: string) => {
    if (expandedWine === wineName) { setExpandedWine(null); return; }
    setExpandedWine(wineName);
    setShipLoading(true);
    setShipShowAll(false);
    setWineShipments([]);
    try {
      const codes = itemCodes.split(', ').map(c => c.trim());
      const res = await fetch('/api/forecast/detail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCodes: codes, startDate: `${startYear}-01-01`, endDate: `${endYear}-12-31`, manager: activeManager }),
      });
      const data = await res.json();
      setWineShipments(data.shipments || []);
    } catch { setWineShipments([]); }
    finally { setShipLoading(false); }
  };

  // 요약 계산
  const totalRaw = results?.reduce((s, r) => s + r.qty_per_item_raw, 0) || 0;
  const totalCorrected = results?.reduce((s, r) => s + r.qty_per_item, 0) || 0;
  const totalYear1 = results?.reduce((s, r) => s + (r.qty_per_item_year1 ?? r.qty_per_item), 0) || 0;
  const displayTotal = isNewItem ? totalYear1 : totalCorrected;
  const totalClients = results?.reduce((s, r) => s + r.avg_clients, 0) || 0;
  const totalCases = Math.ceil(displayTotal / 12);
  const correctionPct = totalRaw > 0 ? Math.round((totalCorrected - totalRaw) / totalRaw * 100) : 0;

  // 전체 통합 데이터 생성
  const mergedData: ManagerStat | null = (() => {
    if (!results || results.length === 0) return null;
    // 와인별 통합 (가격은 판매량 가중 평균)
    const wineAgg: Record<string, WineDetail & { _supplyAmt: number; _sellingAmt: number; _priceQty: number }> = {};
    for (const r of results) {
      for (const w of r.wine_details || []) {
        if (!wineAgg[w.item_name]) {
          wineAgg[w.item_name] = { ...w, _supplyAmt: w.supply_price * w.total_qty, _sellingAmt: w.avg_selling_price * w.total_qty, _priceQty: w.total_qty };
        } else {
          const a = wineAgg[w.item_name];
          a._supplyAmt += w.supply_price * w.total_qty;
          a._sellingAmt += w.avg_selling_price * w.total_qty;
          a._priceQty += w.total_qty;
          a.total_qty += w.total_qty;
          a.corrected_qty += w.corrected_qty;
          a.client_count += w.client_count;
          a.years_sold = Math.max(a.years_sold, w.years_sold);
          a.annual_avg += w.annual_avg;
          a.annual_avg_corrected += w.annual_avg_corrected;
          if (w.avg_import_cost > 0 && a.avg_import_cost === 0) a.avg_import_cost = w.avg_import_cost;
          // 가중 평균 갱신
          a.supply_price = Math.round(a._supplyAmt / a._priceQty);
          a.avg_selling_price = Math.round(a._sellingAmt / a._priceQty);
        }
      }
    }
    const allWines = Object.values(wineAgg).sort((a, b) => b.corrected_qty - a.corrected_qty);

    // 거래처별 통합
    const clientAgg: Record<string, TopClient> = {};
    for (const r of results) {
      for (const c of r.top_clients || []) {
        if (!clientAgg[c.client_name]) {
          clientAgg[c.client_name] = { ...c };
        } else {
          clientAgg[c.client_name].total_qty += c.total_qty;
          clientAgg[c.client_name].item_count = Math.max(clientAgg[c.client_name].item_count, c.item_count);
        }
      }
    }
    const allClients = Object.values(clientAgg).sort((a, b) => b.total_qty - a.total_qty).slice(0, 20);

    // 채널별 통합
    const channelAgg: Record<string, ChannelStat> = {};
    for (const r of results) {
      for (const ch of r.channels || []) {
        if (!channelAgg[ch.channel]) channelAgg[ch.channel] = { ...ch };
        else {
          channelAgg[ch.channel].qty += ch.qty;
          channelAgg[ch.channel].annual_qty += ch.annual_qty;
          channelAgg[ch.channel].clients += ch.clients;
          channelAgg[ch.channel].wines = Math.max(channelAgg[ch.channel].wines, ch.wines);
          channelAgg[ch.channel].qty_per_wine += ch.qty_per_wine;
        }
      }
    }
    const allChannels = Object.values(channelAgg).sort((a, b) => b.qty - a.qty);
    const totalChQty = allChannels.reduce((s, c) => s + c.qty, 0);
    allChannels.forEach(c => { c.pct = totalChQty > 0 ? Math.round(c.qty / totalChQty * 100) : 0; });

    // 연도별 통합
    const yearAgg: Record<string, YearDetail> = {};
    for (const r of results) {
      for (const y of r.year_details || []) {
        if (!yearAgg[y.year]) {
          yearAgg[y.year] = { ...y };
        } else {
          yearAgg[y.year].qty += y.qty;
          yearAgg[y.year].correctedQty += y.correctedQty;
          yearAgg[y.year].items = Math.max(yearAgg[y.year].items, y.items);
          yearAgg[y.year].clients += y.clients;
          yearAgg[y.year].qtyPerItem += y.qtyPerItem;
          yearAgg[y.year].qtyPerItemCorrected += y.qtyPerItemCorrected;
        }
      }
    }
    const allYears = Object.values(yearAgg).sort((a, b) => a.year.localeCompare(b.year));

    // 분포
    const perWine = allWines.map(w => w.annual_avg_corrected).filter(v => v >= 6).sort((a, b) => a - b);
    const med = perWine.length > 0 ? perWine[Math.floor(perWine.length / 2)] : 0;

    return {
      manager: '전체',
      years_active: Math.max(...results.map(r => r.years_active)),
      avg_annual_qty: results.reduce((s, r) => s + r.avg_annual_qty, 0),
      avg_annual_qty_corrected: results.reduce((s, r) => s + r.avg_annual_qty_corrected, 0),
      avg_items: Math.max(...results.map(r => r.avg_items)),
      qty_per_item_raw: totalRaw,
      qty_per_item: totalCorrected,
      qty_per_item_year1: isNewItem ? totalYear1 : null,
      avg_clients: totalClients,
      min_qty: Math.min(...results.map(r => r.min_qty)),
      max_qty: results.reduce((s, r) => s + r.max_qty, 0),
      wine_distribution: { median: med, p25: perWine[Math.floor(perWine.length * 0.25)] || 0, p75: perWine[Math.floor(perWine.length * 0.75)] || 0, count: perWine.length },
      channels: allChannels,
      year_details: allYears,
      wine_details: allWines,
      top_clients: allClients,
    };
  })();

  const activeData = activeManager === '__all__' ? mergedData : results?.find(r => r.manager === activeManager) || null;

  return (
    <div style={{ maxWidth: 960 }}>
      {/* ── 조건 입력 ── */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', marginBottom: 24 }}>
        {/* 헤더 */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>수입량 예측</div>
            {/* 기존/신규 토글 */}
            <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
              {([{ v: false, label: '기존' }, { v: true, label: '신규' }] as const).map(opt => (
                <button key={String(opt.v)} onClick={() => { setIsNewItem(opt.v); setResults(null); }}
                  style={{
                    padding: '4px 14px', fontSize: 12, fontWeight: isNewItem === opt.v ? 600 : 400,
                    background: isNewItem === opt.v ? '#111' : '#fff',
                    color: isNewItem === opt.v ? '#fff' : '#999',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {results && results.length > 0 && (
              <button onClick={handleExportExcel}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 500,
                  background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 6,
                  cursor: 'pointer',
                }}>
                Excel
              </button>
            )}
            <button onClick={handleCalculate} disabled={(!country && !brand) || loading}
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 600,
                background: (!country || (!priceMin && !priceMax)) ? '#e0e0e0' : '#5A1515',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: (!country || (!priceMin && !priceMax)) ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}>
              {loading ? '분석 중...' : '분석'}
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 24px 20px' }}>
          {/* 국가 · 지역 · 세부지역 · 타입 · 브랜드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.8fr 0.8fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>국가</label>
              <select value={country} onChange={e => { setCountry(e.target.value); setRegionLabel(''); setSubRegionLabel(''); setRegionSearch(''); setResults(null); }}
                style={selectStyle}>
                <option value="">선택</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>지역</label>
              <select value={regionLabel} onChange={e => handleRegionChange(e.target.value)} disabled={!country}
                style={{ ...selectStyle, opacity: country ? 1 : 0.5 }}>
                <option value="">전체</option>
                {(REGIONS[country] || []).map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>세부 지역</label>
              <select value={subRegionLabel} onChange={e => handleSubRegionChange(e.target.value)} disabled={!regionLabel || availableSubRegions.length === 0}
                style={{ ...selectStyle, opacity: regionLabel && availableSubRegions.length > 0 ? 1 : 0.5 }}>
                <option value="">전체</option>
                {availableSubRegions.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>타입</label>
              <select value={wineType} onChange={e => { setWineType(e.target.value); setResults(null); }}
                style={selectStyle}>
                <option value="">전체</option>
                <option value="레드">레드</option>
                <option value="화이트">화이트</option>
                <option value="스파클링">스파클링</option>
                <option value="로제">로제</option>
                <option value="주정강화">주정강화</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>브랜드</label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input value={brandInput}
                  onChange={e => {
                    const raw = e.target.value.toUpperCase();
                    setBrandInput(raw);
                    const v = raw.replace(/[^A-Z]/g, '').slice(0, 3);
                    const match = v ? brandList.find(b => b.abbr === v) : null;
                    setBrand(match ? match.name : '');
                    setResults(null);
                  }}
                  onBlur={e => { const v = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3); setBrandInput(v); }}
                  style={{ ...inputStyle, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
                />
                {brandInput && (
                  <button onClick={() => { setBrand(''); setBrandInput(''); setResults(null); }}
                    style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #e0e0e0', background: '#fff', fontSize: 10, color: '#999', cursor: 'pointer', flexShrink: 0 }}>X</button>
                )}
              </div>
              {brand && <div style={{ fontSize: 10, color: '#5A1515', fontWeight: 600, marginTop: 2 }}>{brand}</div>}
            </div>
          </div>

          <div style={{ height: 1, background: '#eee', margin: '0 0 16px' }} />

          {/* 필터 옵션 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={excludeBulk} onChange={e => { setExcludeBulk(e.target.checked); setResults(null); }}
                  style={{ width: 14, height: 14, accentColor: '#5A1515', cursor: 'pointer' }} />
                <span style={{ fontWeight: 500, color: '#333' }}>특판 제외</span>
              </label>
              <input type="number" value={bulkThreshold} onChange={e => { setBulkThreshold(Math.max(1, Number(e.target.value) || 60)); setResults(null); }}
                disabled={!excludeBulk}
                style={{ width: 48, padding: '3px 4px', fontSize: 11, fontWeight: 600, textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 4, outline: 'none', color: excludeBulk ? '#333' : '#ccc', background: '#fff' }} />
              <span style={{ fontSize: 11, color: '#aaa' }}>병+</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={excludeSamples} onChange={e => { setExcludeSamples(e.target.checked); setResults(null); }}
                style={{ width: 14, height: 14, accentColor: '#5A1515', cursor: 'pointer' }} />
              <span style={{ fontWeight: 500, color: '#333' }}>샘플 제외</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={noCorrection} onChange={e => { setNoCorrection(e.target.checked); setResults(null); }}
                style={{ width: 14, height: 14, accentColor: '#5A1515', cursor: 'pointer' }} />
              <span style={{ fontWeight: 500, color: '#333' }}>보정 제외</span>
            </label>
            {/* 업종 필터 */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setBizTypeOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, fontWeight: 500, color: excludedBizTypes.size > 0 ? '#c0392b' : '#555', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>
                업종 {excludedBizTypes.size > 0 ? `(${excludedBizTypes.size} 제외)` : '전체'}
                <span style={{ fontSize: 9, color: '#bbb' }}>{bizTypeOpen ? '▲' : '▼'}</span>
              </button>
              {bizTypeOpen && (
                <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 20, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '6px 4px', minWidth: 170 }}>
                  {businessTypes.map(bt => {
                    const isExcluded = excludedBizTypes.has(bt);
                    return (
                      <label key={bt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', cursor: 'pointer', userSelect: 'none', borderRadius: 4, fontSize: 12, color: isExcluded ? '#bbb' : '#333' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8f8f8')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <input type="checkbox" checked={!isExcluded}
                          onChange={() => {
                            setExcludedBizTypes(prev => {
                              const next = new Set(prev);
                              if (next.has(bt)) next.delete(bt); else next.add(bt);
                              return next;
                            });
                            setResults(null);
                          }}
                          style={{ width: 13, height: 13, accentColor: '#5A1515', cursor: 'pointer' }} />
                        <span style={{ textDecoration: isExcluded ? 'line-through' : 'none' }}>{bt}</span>
                      </label>
                    );
                  })}
                  {excludedBizTypes.size > 0 && (
                    <div style={{ borderTop: '1px solid #eee', marginTop: 4, paddingTop: 4 }}>
                      <button onClick={() => { setExcludedBizTypes(new Set()); setResults(null); }}
                        style={{ width: '100%', padding: '4px 10px', fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        초기화
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 공급가 + 분석 기간 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <label style={labelStyle}>공급가</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {PRICE_PRESETS.map(p => {
                  const isActive = priceMin === String(p.min) && priceMax === String(p.max);
                  return (
                    <button key={p.label} onClick={() => setPricePreset(p.min, p.max)}
                      style={{ padding: '3px 10px', fontSize: 11, fontWeight: isActive ? 600 : 400, borderRadius: 4, border: isActive ? '1px solid #5A1515' : '1px solid #e0e0e0', cursor: 'pointer', background: isActive ? '#5A1515' : '#fff', color: isActive ? '#fff' : '#888' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" value={priceMin} onChange={e => { setPriceMin(e.target.value); setResults(null); }}
                  placeholder="0" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: '#ccc', fontSize: 12 }}>~</span>
                <input type="number" value={priceMax} onChange={e => { setPriceMax(e.target.value); setResults(null); }}
                  placeholder="999,999" style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>기간</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {YEAR_PRESETS.map(p => {
                  const isActive = startYear === String(p.start) && endYear === String(p.end);
                  return (
                    <button key={p.label} onClick={() => setYearPreset(p.start, p.end)}
                      style={{ padding: '3px 10px', fontSize: 11, fontWeight: isActive ? 600 : 400, borderRadius: 4, border: isActive ? '1px solid #5A1515' : '1px solid #e0e0e0', cursor: 'pointer', background: isActive ? '#5A1515' : '#fff', color: isActive ? '#fff' : '#888' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={startYear} onChange={e => { setStartYear(e.target.value); setResults(null); }} style={{ ...selectStyle, flex: 1 }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <span style={{ color: '#ccc', fontSize: 12 }}>~</span>
                <select value={endYear} onChange={e => { setEndYear(e.target.value); setResults(null); }} style={{ ...selectStyle, flex: 1 }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 선택 요약 */}
        {(country || priceMin) && (
          <div style={{ padding: '10px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: '#999' }}>
            {isNewItem ? '신규' : '기존'}
            {country && <> · {country}{regionLabel ? ` ${regionLabel}` : ''}{wineType ? ` ${wineType}` : ''}</>}
            {priceMin && priceMax && <> · {Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원</>}
            <> · {startYear}~{endYear}</>
          </div>
        )}
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92750c', marginBottom: 16, border: '1px solid #fde68a', lineHeight: 1.5 }}>
          {message}
        </div>
      )}

      {/* ── 재계산 바 ── */}
      {pendingRecalc && excludedWines.size > 0 && results !== null && (
        <div style={{
          position: 'sticky', top: 80, zIndex: 10, marginBottom: 16,
          padding: '10px 20px', borderRadius: 6,
          background: '#fff', border: '1px solid #e67e22',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#e67e22' }}>{excludedWines.size}개 제외됨</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false); }}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 500, background: '#fff', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#999' }}>
              초기화
            </button>
            <button onClick={handleRecalc} disabled={loading}
              style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600,
                background: '#e67e22', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}>
              {loading ? '계산 중...' : '재계산'}
            </button>
          </div>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <>
          {/* ── 요약 카드 ── */}
          <div style={{ background: '#111', borderRadius: 8, padding: '24px 28px', marginBottom: 16, color: '#fff' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
              {isNewItem ? '신규' : '기존'} · {country}{regionLabel ? ` ${regionLabel}` : ''}{wineType ? ` ${wineType}` : ''} · {Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원 · {startYear}~{endYear} · {matchedItems}개 와인{allMatchedItems > matchedItems ? ` (${allMatchedItems - matchedItems} 제외)` : ''}
            </div>
            <div style={{ display: 'flex', gap: 48, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{displayTotal.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  {isNewItem ? '1년차 예상' : '병/년'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{totalCases}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>케이스</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>{totalClients}<span style={{ fontSize: 13, opacity: 0.5 }}> 거래처</span></div>
              </div>
              {isNewItem && (
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>{totalCorrected.toLocaleString()}<span style={{ fontSize: 13, opacity: 0.5 }}> 2년차~</span></div>
                </div>
              )}
            </div>
          </div>

          {/* ── 월별 판매 추이 차트 ── */}
          {monthlySeries.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e0e0e0', padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 12 }}>월별 판매 추이 (빈티지 통합)</div>
              <MonthlyCompareChart data={monthlySeries} yearly={yearlySeries} startYear={startYear} endYear={endYear} />
            </div>
          )}

          {/* ── 시뮬레이션 ── */}
          <SimulationCard
            mergedData={mergedData}
            results={results}
            isNewItem={isNewItem}
            learningCurve={learningCurve}
            priceStats={priceStats}
          />

          {/* ── 보정 정보 ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', fontSize: 11, color: '#666' }}>
            {stockoutInfo && stockoutInfo.correctedWines > 0 && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee' }}>
                품절보정 +{correctionPct}% · {stockoutInfo.correctedWines}/{stockoutInfo.totalWines}개 ×{stockoutInfo.avgFactor}
              </span>
            )}
            {isNewItem && learningCurve && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee' }}>
                러닝커브 {Math.round(learningCurve.ratio * 100)}%{learningCurve.sampleSize > 0 ? ` · ${learningCurve.sampleSize}개 기반` : ''}
              </span>
            )}
            {activeData?.wine_distribution && activeData.wine_distribution.count >= 4 && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee' }}>
                분포 P25 {activeData.wine_distribution.p25} · 중위 {activeData.wine_distribution.median} · P75 {activeData.wine_distribution.p75}
              </span>
            )}
            {bulkInfo && bulkInfo.excluded > 0 && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee', cursor: 'pointer' }}
                onClick={() => setBulkOpen(v => !v)}>
                특판 {bulkInfo.excluded}건 {bulkInfo.qty.toLocaleString()}병 제외 {bulkOpen ? '▲' : '▼'}
              </span>
            )}
            {sampleInfo && sampleInfo.excluded > 0 && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee' }}>
                샘플 {sampleInfo.excluded}건 제외
              </span>
            )}
            {priceStats && priceStats.avg > 0 && (
              <span style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #eee' }}>
                평균 {priceStats.avg.toLocaleString()}원 ({priceStats.min.toLocaleString()}~{priceStats.max.toLocaleString()})
              </span>
            )}
          </div>
          {/* 특판 상세 (펼침) */}
          {bulkOpen && bulkInfo && bulkInfo.details.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px 60px', gap: 4, fontSize: 10, fontWeight: 600, color: '#aaa', marginBottom: 4 }}>
                <div>날짜</div><div>거래처</div><div>와인</div><div style={{ textAlign: 'right' }}>수량</div><div style={{ textAlign: 'right' }}>담당</div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {bulkInfo.details.map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px 60px', gap: 4, fontSize: 11, color: '#333', padding: '3px 0', borderBottom: i < bulkInfo.details.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <div style={{ color: '#999' }}>{d.date}</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client}</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.wine}</div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{d.qty}병</div>
                    <div style={{ textAlign: 'right', color: '#999' }}>{d.manager}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 트렌드 보정 ── */}
          {trend && Object.keys(trend.items).length > 0 && mergedData && (() => {
            const t = trend.items;
            const total = t['전사'];
            const countryKey = country ? 'country:' + country : null;
            const countryTrend = countryKey && t[countryKey] ? t[countryKey] : null;
            const typeKey = wineType ? 'type:' + wineType : null;
            const typeTrend = typeKey && t[typeKey] ? t[typeKey] : null;

            // 검색 결과 와인들의 실제 지역/브랜드만 추출
            const resultRegions = new Set<string>();
            const resultBrands = new Set<string>();
            for (const w of mergedData.wine_details || []) {
              if (w.region) resultRegions.add(w.region);
            }
            // 브랜드는 results의 wine_details에서 wines 테이블 supplier_kr 기반
            // wine_details에는 brand가 없으므로 트렌드 키에서 매칭
            for (const r of results) {
              for (const w of r.wine_details || []) {
                // 트렌드 키 중 이 와인명이 포함된 브랜드 찾기
                for (const k of Object.keys(t)) {
                  if (k.startsWith('brand:') && w.item_name.includes(k.replace('brand:', '').substring(0, 4))) {
                    resultBrands.add(k);
                  }
                }
              }
            }

            // 검색 결과에 해당하는 지역만
            const topRegions = Object.keys(t)
              .filter(k => k.startsWith('region:') && resultRegions.has(k.replace('region:', '')))
              .sort((a, b) => (t[b].cur + t[b].prev) - (t[a].cur + t[a].prev))
              .slice(0, 3);

            // 검색 결과에 해당하는 브랜드만 (매칭 안 되면 국가 기준 Top)
            let brandKeys = [...resultBrands]
              .filter(k => t[k])
              .sort((a, b) => (t[b].cur + t[b].prev) - (t[a].cur + t[a].prev))
              .slice(0, 3);
            if (brandKeys.length === 0 && countryKey) {
              // fallback: 같은 국가의 브랜드 중 큰 것
              brandKeys = Object.keys(t)
                .filter(k => k.startsWith('brand:') && t[k].prev + t[k].cur > 50)
                .sort((a, b) => (t[b].cur + t[b].prev) - (t[a].cur + t[a].prev))
                .slice(0, 3);
            }

            const renderPct = (pct: number) => {
              const color = pct > 10 ? '#27ae60' : pct < -10 ? '#c0392b' : '#8a8580';
              const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
              return <span style={{ fontWeight: 700, color }}>{arrow}{pct > 0 ? '+' : ''}{pct}%</span>;
            };

            return (
              <div style={{ background: '#fafafa', borderRadius: 6, padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                  트렌드 {trend.prevYear}→{trend.year}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                  {total && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a8580' }}>전사</span> {renderPct(total.pct)}
                      <span style={{ fontSize: 10, color: '#b0a8a0' }}>{total.prev.toLocaleString()}→{total.cur.toLocaleString()}</span>
                    </div>
                  )}
                  {countryTrend && countryKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a8580' }}>{countryKey.replace('country:', '')}</span> {renderPct(countryTrend.pct)}
                    </div>
                  )}
                  {topRegions.map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a8580' }}>{k.replace('region:', '').substring(0, 15)}</span> {renderPct(t[k].pct)}
                    </div>
                  ))}
                  {typeTrend && typeKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a8580' }}>{typeKey.replace('type:', '')}</span> {renderPct(typeTrend.pct)}
                    </div>
                  )}
                  {brandKeys.slice(0, 3).map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a8580' }}>{k.replace('brand:', '')}</span> {renderPct(t[k].pct)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── 영업사원 선택 바 ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {(() => {
              const isActive = activeManager === '__all__';
              return (
                <button onClick={() => { setActiveManager('__all__'); setDetailTab('wines'); }}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: isActive ? '1.5px solid #111' : '1px solid #e0e0e0',
                    background: isActive ? '#111' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#fff' : '#666' }}>전체</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: isActive ? 'rgba(255,255,255,0.6)' : '#aaa' }}>
                    {displayTotal}병 · {totalClients}곳
                  </div>
                </button>
              );
            })()}
            {results.map(r => {
              const isActive = activeManager === r.manager;
              const displayQty = isNewItem ? (r.qty_per_item_year1 ?? r.qty_per_item) : r.qty_per_item;
              return (
                <button key={r.manager} onClick={() => { setActiveManager(r.manager); setDetailTab('wines'); }}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: isActive ? '1.5px solid #5A1515' : '1px solid #e0e0e0',
                    background: isActive ? '#5A1515' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#fff' : '#333' }}>{r.manager}</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: isActive ? 'rgba(255,255,255,0.6)' : '#aaa' }}>
                    {displayQty}병{isNewItem ? ` →${r.qty_per_item}` : ''} · {r.avg_clients}곳
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 선택된 영업사원 상세 ── */}
          {activeData && (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                {([
                  { id: 'wines' as const, label: `와인 ${activeData.wine_details?.length || 0}` },
                  { id: 'years' as const, label: '연도별' },
                  { id: 'clients' as const, label: `거래처 ${activeData.top_clients?.length || 0}` },
                  { id: 'channels' as const, label: `채널 ${activeData.channels?.length || 0}` },
                ]).map(tab => (
                  <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                    style={{
                      padding: '10px 18px', fontSize: 12, fontWeight: detailTab === tab.id ? 600 : 400,
                      color: detailTab === tab.id ? '#111' : '#999', background: 'transparent', border: 'none',
                      borderBottom: detailTab === tab.id ? '2px solid #111' : '2px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 판매 와인 상세 */}
              {detailTab === 'wines' && activeData.wine_details && (() => {
                const wineNames = activeData.wine_details.map(w => w.item_name);
                const allChecked = wineNames.length > 0 && wineNames.every(n => excludedWines.has(n));
                const someChecked = wineNames.some(n => excludedWines.has(n));
                const checkedCount = wineNames.filter(n => excludedWines.has(n)).length;

                const toggleAll = () => {
                  if (allChecked) {
                    // 전체 해제
                    setExcludedWines(prev => {
                      const next = new Set(prev);
                      for (const n of wineNames) next.delete(n);
                      return next;
                    });
                    setExcludedWineDetails(d => d.filter(w => !wineNames.includes(w.item_name)));
                  } else {
                    // 전체 선택
                    setExcludedWines(prev => {
                      const next = new Set(prev);
                      for (const n of wineNames) next.add(n);
                      return next;
                    });
                    const existing = new Set(excludedWineDetails.map(w => w.item_name));
                    const toAdd = activeData.wine_details!
                      .filter(w => !existing.has(w.item_name))
                      .map(w => ({ item_name: w.item_name, supply_price: w.supply_price, region: w.region }));
                    if (toAdd.length) setExcludedWineDetails(d => [...d, ...toAdd]);
                  }
                  setPendingRecalc(true);
                };

                return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={toggleAll} style={{ width: 14, height: 14, accentColor: '#5A1515', cursor: 'pointer' }} />
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {checkedCount > 0 ? `${checkedCount}개 선택` : '전체'}
                      </span>
                    </div>
                    {checkedCount > 0 && (
                      <span style={{ fontSize: 11, color: '#e67e22' }}>재계산 시 제외</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 70px 70px 70px 60px 50px 90px', padding: '6px 20px', fontSize: 10, color: '#bbb', fontWeight: 500, borderBottom: '1px solid #eee', textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>
                    <div></div>
                    <div>와인</div>
                    <div style={{ textAlign: 'right' }}>공급가</div>
                    <div style={{ textAlign: 'right' }}>평균가</div>
                    <div style={{ textAlign: 'right' }}>원가</div>
                    <div style={{ textAlign: 'right' }}>이익</div>
                    <div style={{ textAlign: 'right' }}>거래처</div>
                    <div style={{ textAlign: 'right' }}>판매</div>
                  </div>
                  {activeData.wine_details.map((w, i) => {
                    const hasStockout = w.stockout_factor > 1;
                    const isChecked = excludedWines.has(w.item_name);
                    return (
                      <div key={w.item_code} style={{ borderBottom: i < (activeData.wine_details?.length || 1) - 1 ? '1px solid #f5f5f5' : 'none', opacity: isChecked ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 70px 70px 70px 60px 50px 90px', padding: '8px 20px', alignItems: 'center' }}>
                          <div>
                            <input type="checkbox" checked={isChecked}
                              onChange={() => toggleExcludeWine(w.item_name, { supply_price: w.supply_price, region: w.region })}
                              style={{ width: 14, height: 14, accentColor: '#c0392b', cursor: 'pointer' }} />
                          </div>
                          <div style={{ cursor: 'pointer' }} onClick={() => handleWineClick(w.item_name, w.item_code)}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: isChecked ? '#bbb' : '#222', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6, textDecoration: isChecked ? 'line-through' : 'none' }}>
                              {w.item_name}
                              {hasStockout && !isChecked && (
                                <span style={{ fontSize: 9, color: '#e67e22', fontWeight: 600 }}>×{w.stockout_factor}</span>
                              )}
                              <span style={{ fontSize: 9, color: '#ccc' }}>{expandedWine === w.item_name ? '▲' : '▼'}</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>
                              {w.item_code}{w.region ? ` · ${w.region}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#999' }}>{w.supply_price?.toLocaleString()}</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: '#222', fontWeight: 500 }}>{w.avg_selling_price?.toLocaleString()}</div>
                            {w.avg_selling_price !== w.supply_price && w.supply_price > 0 && (
                              <div style={{ fontSize: 10, color: w.avg_selling_price < w.supply_price ? '#e67e22' : '#27ae60' }}>
                                {w.avg_selling_price < w.supply_price ? '' : '+'}{Math.round((w.avg_selling_price - w.supply_price) / w.supply_price * 100)}%
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: w.avg_import_cost > 0 ? '#666' : '#ddd' }}>
                            {w.avg_import_cost > 0 ? w.avg_import_cost.toLocaleString() : '-'}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12 }}>
                            {w.avg_import_cost > 0 && w.avg_selling_price > 0 ? (() => {
                              const profit = w.avg_selling_price - w.avg_import_cost;
                              const pct = Math.round(profit / w.avg_import_cost * 100);
                              return (
                                <div style={{ color: profit >= 0 ? '#27ae60' : '#c0392b', fontWeight: 500 }}>{pct >= 0 ? '+' : ''}{pct}%</div>
                              );
                            })() : <span style={{ color: '#ddd' }}>-</span>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#999' }}>{w.client_count}</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: isChecked ? '#ccc' : '#222' }}>{w.corrected_qty.toLocaleString()}</span>
                            {hasStockout && !isChecked && (
                              <span style={{ fontSize: 10, color: '#bbb', textDecoration: 'line-through', marginLeft: 4 }}>{w.total_qty.toLocaleString()}</span>
                            )}
                            <div style={{ fontSize: 10, color: '#bbb' }}>avg {w.annual_avg_corrected}/y</div>
                          </div>
                        </div>
                        {/* 출고 상세 이력 — 거래처별 그룹 */}
                        {expandedWine === w.item_name && (
                          <div style={{ padding: '0 20px 12px 56px', background: '#fafafa' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                            {shipLoading ? (
                              <div style={{ padding: 12, fontSize: 12, color: '#999' }}>조회 중...</div>
                            ) : wineShipments.length === 0 ? (
                              <div style={{ padding: 12, fontSize: 12, color: '#999' }}>출고 이력 없음</div>
                            ) : (
                              (() => {
                                // 거래처별 그룹핑
                                const clientGroups: Record<string, { client: string; totalQty: number; prices: Record<number, number>; managers: Set<string>; lastDate: string }> = {};
                                for (const s of wineShipments) {
                                  if (!clientGroups[s.client]) {
                                    clientGroups[s.client] = { client: s.client, totalQty: 0, prices: {}, managers: new Set(), lastDate: s.date };
                                  }
                                  const g = clientGroups[s.client];
                                  g.totalQty += s.qty;
                                  if (s.price > 0) g.prices[s.price] = (g.prices[s.price] || 0) + s.qty;
                                  if (s.manager) g.managers.add(s.manager);
                                  if (s.date > g.lastDate) g.lastDate = s.date;
                                }
                                const grouped = Object.values(clientGroups).sort((a, b) => b.totalQty - a.totalQty);
                                const LIMIT = 10;
                                const showSlice = shipShowAll ? grouped : grouped.slice(0, LIMIT);
                                const hasMore = grouped.length > LIMIT;

                                return (
                                  <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 60px', gap: 4, fontSize: 10, fontWeight: 500, color: '#bbb', padding: '6px 0 4px', borderBottom: '1px solid #eee' }}>
                                      <div>거래처</div><div style={{ textAlign: 'right' }}>공급가</div><div style={{ textAlign: 'right' }}>수량</div><div style={{ textAlign: 'right' }}>담당</div>
                                    </div>
                                    <div ref={shipShowAll ? scrollRef : undefined} style={shipShowAll ? { height: 400, overflowY: 'scroll', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 2 } : {}}>
                                      {showSlice.map((g, gi) => {
                                        const priceEntries = Object.entries(g.prices).map(([p, q]) => ({ price: Number(p), qty: q })).sort((a, b) => b.qty - a.qty);
                                        const mgrs = [...g.managers].join('/');
                                        if (priceEntries.length <= 1) {
                                          return (
                                            <div key={gi} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 60px', gap: 4, fontSize: 11, padding: '4px 0', borderBottom: gi < showSlice.length - 1 ? '1px solid #f0f0f0' : 'none', alignItems: 'center' }}>
                                              <div style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.client}</div>
                                              <div style={{ textAlign: 'right', color: priceEntries[0] && priceEntries[0].price < w.supply_price ? '#e67e22' : '#999', fontWeight: 500 }}>
                                                {priceEntries[0] ? priceEntries[0].price.toLocaleString() : '-'}
                                              </div>
                                              <div style={{ textAlign: 'right', fontWeight: 600, color: '#222' }}>{g.totalQty}</div>
                                              <div style={{ textAlign: 'right', color: '#bbb', fontSize: 10 }}>{mgrs}</div>
                                            </div>
                                          );
                                        }
                                        // 공급가가 다른 경우: 첫 행에 합계, 하위에 가격별 내역
                                        return (
                                          <div key={gi} style={{ borderBottom: gi < showSlice.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 60px', gap: 4, fontSize: 11, padding: '4px 0', alignItems: 'center' }}>
                                              <div style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.client}</div>
                                              <div style={{ textAlign: 'right', color: '#999', fontSize: 10 }}>가격 {priceEntries.length}종</div>
                                              <div style={{ textAlign: 'right', fontWeight: 600, color: '#222' }}>{g.totalQty}</div>
                                              <div style={{ textAlign: 'right', color: '#bbb', fontSize: 10 }}>{mgrs}</div>
                                            </div>
                                            {priceEntries.map((pe, pi) => (
                                              <div key={pi} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 60px', gap: 4, fontSize: 10, padding: '2px 0 2px 12px', color: '#888' }}>
                                                <div></div>
                                                <div style={{ textAlign: 'right', color: pe.price < w.supply_price ? '#e67e22' : '#999' }}>{pe.price.toLocaleString()}</div>
                                                <div style={{ textAlign: 'right' }}>{pe.qty}</div>
                                                <div></div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div style={{ padding: '6px 0 0', fontSize: 11, color: '#999', borderTop: '1px solid #eee', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>{wineShipments.reduce((s, r) => s + r.qty, 0)}병 · {grouped.length}거래처</span>
                                      {hasMore && (
                                        <button
                                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setShipShowAll(v => !v); }}
                                          style={{ fontSize: 11, fontWeight: 500, color: '#555', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', position: 'relative', zIndex: 5 }}>
                                          {shipShowAll ? '10거래처' : `전체 ${grouped.length}거래처`}
                                        </button>
                                      )}
                                    </div>
                                  </>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 합계 행 */}
                  {(() => {
                    const details = activeData.wine_details || [];
                    const totalQty = details.filter(w => !excludedWines.has(w.item_name)).reduce((s, w) => s + w.corrected_qty, 0);
                    const totalProfit = details.filter(w => !excludedWines.has(w.item_name) && w.avg_import_cost > 0 && w.avg_selling_price > 0)
                      .reduce((s, w) => s + (w.avg_selling_price - w.avg_import_cost) * w.corrected_qty, 0);
                    const totalCost = details.filter(w => !excludedWines.has(w.item_name) && w.avg_import_cost > 0)
                      .reduce((s, w) => s + w.avg_import_cost * w.corrected_qty, 0);
                    const avgMargin = totalCost > 0 ? Math.round(totalProfit / totalCost * 100) : 0;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 70px 70px 70px 60px 50px 90px', padding: '8px 20px', background: '#111', fontWeight: 600, color: '#fff', fontSize: 12 }}>
                        <div></div>
                        <div>{details.filter(w => !excludedWines.has(w.item_name)).length}개</div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div style={{ textAlign: 'right' }}>
                          {avgMargin}%
                        </div>
                        <div></div>
                        <div style={{ textAlign: 'right' }}>{totalQty.toLocaleString()}</div>
                      </div>
                    );
                  })()}

                  {/* 제외된 와인 목록 (이전 재계산에서 이미 제외된 것들) */}
                  {excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).length > 0 && (
                    <div style={{ borderTop: '1px dashed #ddd' }}>
                      <div style={{ padding: '6px 20px', fontSize: 10, fontWeight: 500, color: '#bbb' }}>
                        이전 제외 ({excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).length})
                      </div>
                      {excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).map((ew, idx) => (
                        <div key={`excl-${idx}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px', padding: '6px 20px', alignItems: 'center', opacity: 0.4 }}>
                          <div>
                            <input type="checkbox" checked={true}
                              onChange={() => toggleExcludeWine(ew.item_name)}
                              style={{ width: 14, height: 14, accentColor: '#c0392b', cursor: 'pointer' }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through' }}>{ew.item_name}</div>
                          <div style={{ textAlign: 'right', fontSize: 11, color: '#bbb' }}>{ew.supply_price?.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 연도별 추이 */}
              {detailTab === 'years' && activeData.year_details && (() => {
                const details = activeData.year_details;
                const singleYear = details.length === 1;
                const maxYr = Math.max(...details.map(d => Number(d.year)));
                const getWeight = (yr: string) => { if (singleYear) return 1; const diff = maxYr - Number(yr); return diff === 0 ? 3 : diff === 1 ? 2 : 1; };
                const totalWeight = details.reduce((s, d) => s + getWeight(d.year), 0);
                const maxQ = Math.max(...details.map(y => y.correctedQty), 1);
                const maxPerItem = Math.max(...details.map(y => y.qtyPerItemCorrected), 1);

                return (
                  <div style={{ padding: '20px 20px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#999', marginBottom: 12 }}>연도별 판매량</div>
                    {details.map(yd => {
                      const pct = Math.round((yd.correctedQty / maxQ) * 100);
                      const w = getWeight(yd.year);
                      const hasDiff = yd.correctedQty !== yd.qty;
                      return (
                        <div key={yd.year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: '#222' }}>{yd.year}</div>
                          {!singleYear && <div style={{ width: 24, textAlign: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: w === 3 ? '#5A1515' : w === 2 ? '#b87333' : '#ccc' }}>×{w}</span>
                          </div>}
                          <div style={{ flex: 1, height: 28, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: w === 3 ? '#5A1515' : w === 2 ? '#b87333' : '#ccc', borderRadius: 4, transition: 'width 0.3s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: pct > 40 ? '#fff' : '#222' }}>
                              {yd.correctedQty.toLocaleString()}
                              {hasDiff && <span style={{ fontSize: 10, opacity: 0.6 }}> ({yd.qty.toLocaleString()})</span>}
                            </div>
                          </div>
                          <div style={{ width: 90, fontSize: 10, color: '#999', textAlign: 'right' }}>
                            {yd.items}와인 · {yd.clients}거래처
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ height: 1, background: '#eee', margin: '20px 0' }} />

                    <div style={{ fontSize: 11, fontWeight: 500, color: '#999', marginBottom: 12 }}>와인당 판매량</div>
                    {details.map(yd => {
                      const pct = Math.round((yd.qtyPerItemCorrected / maxPerItem) * 100);
                      const w = getWeight(yd.year);
                      return (
                        <div key={yd.year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: '#222' }}>{yd.year}</div>
                          {!singleYear && <div style={{ width: 24, textAlign: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: w === 3 ? '#5A1515' : w === 2 ? '#b87333' : '#ccc' }}>×{w}</span>
                          </div>}
                          <div style={{ flex: 1, height: 28, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: w === 3 ? '#5A1515' : w === 2 ? '#b87333' : '#ccc', borderRadius: 4, transition: 'width 0.3s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: pct > 40 ? '#fff' : '#222' }}>
                              {yd.correctedQty.toLocaleString()} ÷ {isNewItem ? `(${yd.items}+1)` : yd.items} = {yd.qtyPerItemCorrected}
                            </div>
                          </div>
                          {!singleYear && <div style={{ width: 90, fontSize: 11, color: '#999', textAlign: 'right' }}>
                            {yd.qtyPerItemCorrected}×{w} = <strong style={{ color: '#222' }}>{yd.qtyPerItemCorrected * w}</strong>
                          </div>}
                        </div>
                      );
                    })}

                    <div style={{ marginTop: 20, padding: '16px 18px', background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#222', marginBottom: 10 }}>{singleYear ? '기대값' : '가중 평균'}</div>

                      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8, marginBottom: 12 }}>
                        <div>판매량 {activeData.avg_annual_qty_corrected.toLocaleString()}병 · {activeData.avg_items}개 와인</div>
                        {isNewItem ? (
                          <div>{activeData.avg_annual_qty_corrected.toLocaleString()} ÷ ({activeData.avg_items}+1) = <strong style={{ color: '#222' }}>{activeData.qty_per_item}병</strong></div>
                        ) : (
                          <div>{activeData.avg_annual_qty_corrected.toLocaleString()} ÷ {activeData.avg_items} = <strong style={{ color: '#222' }}>{activeData.qty_per_item}병</strong></div>
                        )}
                      </div>

                      {!singleYear && (
                        <div style={{ fontSize: 12, color: '#333', lineHeight: 2, fontFamily: "'SF Mono', 'Consolas', monospace", marginBottom: 8 }}>
                          <div>
                            ({details.map(yd => `${yd.qtyPerItemCorrected}×${getWeight(yd.year)}`).join(' + ')}) ÷ {totalWeight}
                          </div>
                          <div>
                            = {details.reduce((s, yd) => s + yd.qtyPerItemCorrected * getWeight(yd.year), 0)} ÷ {totalWeight}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>{activeData.qty_per_item}</span>
                        <span style={{ fontSize: 13, color: '#999' }}>병/년</span>
                        {Math.abs(activeData.qty_per_item - activeData.qty_per_item_raw) >= 5 && (
                          <span style={{ fontSize: 11, color: '#e67e22' }}>보정 전 {activeData.qty_per_item_raw}</span>
                        )}
                      </div>

                      {/* 러닝커브 적용 */}
                      {isNewItem && learningCurve && activeData.qty_per_item_year1 !== null && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0f7ff', borderRadius: 4, border: '1px solid #d6e8f7' }}>
                          <div style={{ fontSize: 12, color: '#333' }}>
                            1년차: {activeData.qty_per_item} × {Math.round(learningCurve.ratio * 100)}% = <strong>{activeData.qty_per_item_year1}병</strong>
                          </div>
                          {learningCurve.sampleSize > 0 && (
                            <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                              {learningCurve.details.slice(0, 3).map(d => `${d.name.substring(0, 8)}… ${Math.round(d.ratio * 100)}%`).join(', ')} 등 {learningCurve.sampleSize}개
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 10, color: '#bbb' }}>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#5A1515', marginRight: 4, verticalAlign: 'middle' }} />최근 ×3</span>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#b87333', marginRight: 4, verticalAlign: 'middle' }} />직전 ×2</span>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ccc', marginRight: 4, verticalAlign: 'middle' }} />나머지 ×1</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 주요 거래처 */}
              {detailTab === 'clients' && activeData.top_clients && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 90px 80px 80px', padding: '8px 20px', fontSize: 10, color: '#bbb', fontWeight: 500, borderBottom: '1px solid #eee', textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>
                    <div>#</div><div>거래처</div><div>업종</div><div style={{ textAlign: 'right' }}>품목</div><div style={{ textAlign: 'right' }}>구매</div>
                  </div>
                  {activeData.top_clients.map((c, i) => (
                    <div key={c.client_name} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 90px 80px 80px', padding: '8px 20px', borderBottom: i < (activeData.top_clients?.length || 1) - 1 ? '1px solid #f5f5f5' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: i < 3 ? '#222' : '#ccc' }}>{i + 1}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{c.client_name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{c.business_type || ''}</div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#999' }}>{c.item_count}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#222' }}>{c.total_qty.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 채널별 분석 */}
              {detailTab === 'channels' && activeData.channels && activeData.channels.length > 0 && (() => {
                const chs = activeData.channels;
                const maxQty = chs[0]?.qty || 1;
                const channelColors: Record<string, string> = {
                  'on/업소': '#e74c3c', 'on/호텔': '#c0392b', 'on/샵': '#e67e22', 'on/도매장': '#f39c12',
                  'off/백화점': '#3498db', 'off/편의점': '#2980b9', 'off/할인점': '#1abc9c',
                  '백화점': '#3498db', '백화점(와인)': '#2c6faa',
                  'etc/기타': '#95a5a6', '(미분류)': '#bdc3c7',
                };
                return (
                  <div style={{ padding: '16px 20px' }}>
                    {chs.map((ch) => {
                      const pct = Math.round(ch.qty / maxQty * 100);
                      const color = channelColors[ch.channel] || '#999';
                      return (
                        <div key={ch.channel} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{ch.channel}</span>
                              <span style={{ fontSize: 11, color: '#bbb' }}>{ch.pct}%</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#999' }}>
                              <span>{ch.clients}거래처</span>
                              <span>{ch.wines}와인</span>
                              <span style={{ fontWeight: 600, color: '#222' }}>{ch.annual_qty.toLocaleString()}/년</span>
                            </div>
                          </div>
                          <div style={{ height: 20, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: pct > 35 ? '#fff' : '#222' }}>
                              {ch.qty.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {chs.filter(c => c.qty_per_wine > 0).map(ch => {
                        const color = channelColors[ch.channel] || '#999';
                        return (
                          <span key={ch.channel} style={{ padding: '3px 10px', borderRadius: 4, background: '#fafafa', border: '1px solid #eee', fontSize: 11, color: '#333' }}>
                            {ch.channel} <strong style={{ color }}>{ch.qty_per_wine}</strong>/년
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 산출 기준 */}
          <div style={{ padding: '12px 16px', fontSize: 11, color: '#999', lineHeight: 1.8 }}>
            {startYear}~{endYear} · {Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원 · {matchedItems}개 품목.
            {stockoutInfo && stockoutInfo.correctedWines > 0 && (
              <> 품절보정 {stockoutInfo.correctedWines}개 ×{stockoutInfo.avgFactor}.</>
            )}
            {isNewItem && learningCurve && (
              <> 러닝커브 {Math.round(learningCurve.ratio * 100)}% ({learningCurve.sampleSize}개 기반).</>
            )}
          </div>
        </>
      )}

      {results !== null && results.length === 0 && !message && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999', fontSize: 13, background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
          해당 조건의 판매 이력이 없습니다.<br /><span style={{ fontSize: 11 }}>조건을 조정해 보세요.</span>
        </div>
      )}

      {/* ── 브랜드 소진 분석 ── */}
      <BrandVelocitySection startYear={startYear} endYear={endYear} />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      background: '#f5f5f5', borderRadius: 3, fontSize: 11, fontWeight: 500, color: '#555',
    }}>
      {children}
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 5, display: 'block',
  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', outline: 'none',
  color: '#222', appearance: 'none' as const, WebkitAppearance: 'none' as const,
  transition: 'border-color 0.15s',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #e0e0e0', borderRadius: 6, outline: 'none',
  boxSizing: 'border-box', color: '#222', background: '#fff',
  transition: 'border-color 0.15s',
};

// ── 시뮬레이션 카드 ──
function SimulationCard({ mergedData, results, isNewItem, learningCurve, priceStats }: {
  mergedData: ManagerStat | null;
  results: ManagerStat[];
  isNewItem: boolean;
  learningCurve: LearningCurve | null;
  priceStats: PriceStats | null;
}) {
  const [importCases, setImportCases] = useState(10);
  const [bottlesPerCase, setBottlesPerCase] = useState(12);
  // 수입원가: wine_details에서 avg_import_cost 평균 계산 (없으면 공급가 fallback)
  const avgImportCost = (() => {
    const details = mergedData?.wine_details || [];
    const withCost = details.filter(w => w.avg_import_cost > 0);
    if (withCost.length > 0) return Math.round(withCost.reduce((s, w) => s + w.avg_import_cost, 0) / withCost.length);
    return priceStats?.avg || 50000;
  })();
  const [costPrice, setCostPrice] = useState(avgImportCost);
  const [marginPct, setMarginPct] = useState(20);

  useEffect(() => { if (avgImportCost > 0) setCostPrice(avgImportCost); }, [avgImportCost]);

  if (!mergedData || !mergedData.wine_details?.length) return null;

  // 기대값 기준 시나리오 (qty_per_item = 총판매량 ÷ 와인수)
  const baseQty = isNewItem
    ? (mergedData.qty_per_item_year1 ?? mergedData.qty_per_item)
    : mergedData.qty_per_item;
  if (!baseQty || baseQty <= 0) return null;

  const lc = 1; // 이미 qty_per_item_year1에 러닝커브 반영됨

  const wines = (mergedData.wine_details || [])
    .map(w => ({ name: w.item_name, annual: w.annual_avg_corrected, price: w.avg_selling_price }))
    .filter(w => w.annual >= 6)
    .sort((a, b) => a.annual - b.annual);

  const scenarios = [
    { label: '보수적', value: Math.round(baseQty * 0.6), color: '#95a5a6', icon: '▽' },
    { label: '기본', value: baseQty, color: '#5A1515', icon: '■' },
    { label: '낙관적', value: Math.round(baseQty * 1.5), color: '#27ae60', icon: '△' },
  ];

  const importBottles = importCases * bottlesPerCase;
  const totalInvestment = importBottles * costPrice;
  const sellingPrice = Math.round(costPrice * (1 + marginPct / 100));

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>투자 시뮬레이션</div>
      </div>

      {/* 입력 */}
      <div style={{ padding: '14px 24px', display: 'flex', gap: 20, flexWrap: 'wrap', borderBottom: '1px solid #eee' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 4 }}>수입량</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={100} value={importCases} onChange={e => setImportCases(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#5A1515' }} />
            <input type="number" value={importCases} onChange={e => setImportCases(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 48, padding: '3px 4px', fontSize: 13, fontWeight: 600, textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 4, color: '#222' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {[6, 12].map(n => (
              <button key={n} onClick={() => setBottlesPerCase(n)}
                style={{ padding: '2px 8px', fontSize: 10, fontWeight: 500, border: `1px solid ${bottlesPerCase === n ? '#111' : '#e0e0e0'}`, borderRadius: 3, background: bottlesPerCase === n ? '#111' : '#fff', color: bottlesPerCase === n ? '#fff' : '#999', cursor: 'pointer' }}>
                {n}병
              </button>
            ))}
            <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>{importBottles.toLocaleString()}병 · {Math.round(totalInvestment / 10000).toLocaleString()}만원</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 4 }}>수입원가</div>
          <input type="number" value={costPrice} onChange={e => setCostPrice(Number(e.target.value) || 0)}
            style={{ width: '100%', padding: '5px 10px', fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 4, color: '#222' }} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 4 }}>마진율</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={5} max={200} value={marginPct} onChange={e => setMarginPct(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#5A1515' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#222', minWidth: 36 }}>{marginPct}%</span>
          </div>
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>판매가 {sellingPrice.toLocaleString()}원</div>
        </div>
      </div>

      {/* 시나리오별 결과 */}
      <div style={{ padding: '14px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
          {scenarios.map(s => {
            const yr1Sales = Math.round(s.value * lc);
            const yr1Revenue = yr1Sales * sellingPrice;
            const yr1Profit = yr1Sales * (sellingPrice - costPrice);
            const sellThruPct = importBottles > 0 ? Math.min(100, Math.round(yr1Sales / importBottles * 100)) : 0;
            const remainBottles = Math.max(0, importBottles - yr1Sales);
            const roi = totalInvestment > 0 ? Math.round(yr1Profit / totalInvestment * 100) : 0;
            const monthsToSell = yr1Sales > 0 ? Math.round(importBottles / yr1Sales * 12) : 999;

            return (
              <div key={s.label} style={{ padding: 14, borderRadius: 6, border: '1px solid #eee' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#222', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{s.label}</span>
                  <span style={{ fontWeight: 400, color: '#bbb' }}>{yr1Sales}병</span>
                </div>

                <div style={{ fontSize: 11, color: '#666', lineHeight: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>매출</span>
                    <span style={{ color: '#222' }}>{Math.round(yr1Revenue / 10000).toLocaleString()}만</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>수익</span>
                    <span style={{ color: yr1Profit >= 0 ? '#27ae60' : '#c0392b', fontWeight: 600 }}>{yr1Profit >= 0 ? '+' : ''}{Math.round(yr1Profit / 10000).toLocaleString()}만</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ROI</span>
                    <span style={{ color: roi >= 0 ? '#27ae60' : '#c0392b', fontWeight: 600 }}>{roi >= 0 ? '+' : ''}{roi}%</span>
                  </div>

                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${sellThruPct}%`, background: sellThruPct >= 80 ? '#27ae60' : sellThruPct >= 50 ? '#e67e22' : '#c0392b', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb', marginTop: 3 }}>
                      <span>{sellThruPct}% 소진</span>
                      <span>{monthsToSell >= 999 ? '-' : `${monthsToSell}개월`}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {wines.length > 0 && (
        <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: '#bbb', marginBottom: 6 }}>기대값 {baseQty}병/년 · {wines.length}개 와인 기반</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {wines.map((w, i) => (
              <span key={i} style={{ padding: '2px 6px', borderRadius: 3, fontSize: 10, background: '#f5f5f5', color: '#555' }}>
                {w.name.substring(0, 15)}{w.name.length > 15 ? '…' : ''} <strong>{w.annual}</strong>
              </span>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── 브랜드 소진 분석 ──

function BrandVelocitySection({ startYear, endYear }: { startYear: string; endYear: string }) {
  const [brands, setBrands] = useState<{
    brand: string; country: string; items: number; total: number;
    monthlyAvg: number; spanMonths: number; avgPrice: number;
    m1: number; m3: number; m6: number; m12: number; pattern: string;
    months5c: number; months10c: number; months20c: number;
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'total' | 'monthlyAvg' | 'avgPrice' | 'items'>('total');
  const [filterPrice, setFilterPrice] = useState('all');

  const [lastPeriod, setLastPeriod] = useState('');

  const loadBrands = async () => {
    const period = `${startYear}-${endYear}`;
    if (brands.length > 0 && lastPeriod === period) { setOpen(v => !v); return; }
    setLoading(true);
    setLastPeriod(period);
    try {
      const res = await fetch(`/api/forecast/brands?startYear=${startYear}&endYear=${endYear}`);
      const data = await res.json();
      setBrands(data.brands || []);
      setOpen(true);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  const filtered = brands.filter(b => {
    if (filterPrice === 'all') return true;
    if (filterPrice === '~2만') return b.avgPrice > 0 && b.avgPrice < 20000;
    if (filterPrice === '2~5만') return b.avgPrice >= 20000 && b.avgPrice < 50000;
    if (filterPrice === '5~10만') return b.avgPrice >= 50000 && b.avgPrice < 100000;
    if (filterPrice === '10만~') return b.avgPrice >= 100000;
    return true;
  }).sort((a, b) => (b as Record<string, number>)[sortKey] - (a as Record<string, number>)[sortKey]);

  const patternColor: Record<string, string> = { '초반집중': '#e74c3c', '꾸준': '#27ae60', '후반가속': '#3498db' };

  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={loadBrands}
        style={{ width: '100%', padding: '12px 20px', background: '#fff', borderRadius: 6, border: '1px solid #e0e0e0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', textAlign: 'left' }}>브랜드 소진 분석</div>
        <span style={{ fontSize: 11, color: '#bbb' }}>{loading ? '...' : open ? '▲' : '▼'}</span>
      </button>

      {open && brands.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '0 0 6px 6px', border: '1px solid #e0e0e0', borderTop: 'none', padding: '12px 0' }}>
          <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
            {['all', '~2만', '2~5만', '5~10만', '10만~'].map(p => (
              <button key={p} onClick={() => setFilterPrice(p)}
                style={{ padding: '2px 8px', fontSize: 10, borderRadius: 3, border: filterPrice === p ? '1px solid #111' : '1px solid #e0e0e0', cursor: 'pointer', fontWeight: filterPrice === p ? 600 : 400, background: filterPrice === p ? '#111' : '#fff', color: filterPrice === p ? '#fff' : '#999' }}>
                {p === 'all' ? '전체' : p}
              </button>
            ))}
            <span style={{ color: '#ddd' }}>|</span>
            {([['total', '총판매'], ['monthlyAvg', '월평균'], ['avgPrice', '가격'], ['items', '품목']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSortKey(k)}
                style={{ padding: '2px 8px', fontSize: 10, borderRadius: 3, border: sortKey === k ? '1px solid #111' : '1px solid #e0e0e0', cursor: 'pointer', fontWeight: sortKey === k ? 600 : 400, background: sortKey === k ? '#111' : '#fff', color: sortKey === k ? '#fff' : '#999' }}>
                {l}
              </button>
            ))}
            <span style={{ color: '#ccc', marginLeft: 'auto' }}>{filtered.length}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 55px 70px 65px 55px 55px 55px 60px', padding: '6px 20px', fontSize: 10, color: '#bbb', fontWeight: 500, borderBottom: '1px solid #eee' }}>
            <div>브랜드</div><div style={{ textAlign: 'right' }}>품목</div><div style={{ textAlign: 'right' }}>가격</div>
            <div style={{ textAlign: 'right' }}>총판매</div><div style={{ textAlign: 'right' }}>월평균</div>
            <div style={{ textAlign: 'center' }}>5cs</div><div style={{ textAlign: 'center' }}>10cs</div><div style={{ textAlign: 'center' }}>20cs</div>
            <div style={{ textAlign: 'center' }}>패턴</div>
          </div>

          {filtered.map((b) => (
            <div key={b.brand} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 55px 70px 65px 55px 55px 55px 60px', padding: '8px 20px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{b.brand}</div>
                  <div style={{ fontSize: 10, color: '#ccc' }}>{b.country}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#999' }}>{b.items}</div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#999' }}>{b.avgPrice > 0 ? (b.avgPrice / 1000).toFixed(0) + 'k' : '-'}</div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#222' }}>{b.total.toLocaleString()}</div>
                <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#555' }}>{b.monthlyAvg.toLocaleString()}</div>
                <div style={{ textAlign: 'center', fontSize: 11, color: b.months5c <= 1 ? '#27ae60' : '#999' }}>{b.months5c}</div>
                <div style={{ textAlign: 'center', fontSize: 11, color: b.months10c <= 3 ? '#27ae60' : b.months10c <= 6 ? '#e67e22' : '#c0392b' }}>{b.months10c}</div>
                <div style={{ textAlign: 'center', fontSize: 11, color: b.months20c <= 6 ? '#27ae60' : b.months20c <= 12 ? '#e67e22' : '#c0392b' }}>{b.months20c}</div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: patternColor[b.pattern] || '#999' }}>{b.pattern}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
