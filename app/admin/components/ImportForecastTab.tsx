'use client';

import { useState, useRef, useEffect } from 'react';

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
  const [wineType, setWineType] = useState('');
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
    const found = (REGIONS[country] || []).find(r => r.label === label);
    setRegionSearch(found?.search || '');
    setResults(null); setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false);
  };

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
    if (!country || (!priceMin && !priceMax)) return;
    const useBulk = bulk !== undefined ? bulk : excludeBulk;
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, regionSearch: regionSearch || null, wineType: wineType || null, priceMin: Number(priceMin) || 0, priceMax: Number(priceMax) || 999999999, startYear: Number(startYear), endYear: Number(endYear), isNewItem, excludeWineNames: excludeNames, excludeBulkSales: useBulk, bulkThreshold, excludeSamples, noCorrection, excludeBusinessTypes: [...excludedBizTypes] }),
      });
      const data = await res.json();
      setResults(data.stats || []);
      setPriceRange(data.priceRange || null);
      setMessage(data.message || '');
      setMatchedItems(data.matchedItems || 0);
      setAllMatchedItems(data.allMatchedItems || data.matchedItems || 0);
      setStockoutInfo(data.stockoutInfo || null);
      // 트렌드는 별도 API로 로드 (전체 와인 기준)
      fetch(`/api/forecast/trends?endYear=${Number(endYear)}`)
        .then(r => r.json()).then(d => setTrend(d)).catch(() => setTrend(null));
      setBulkInfo(data.bulkInfo || null);
      setSampleInfo(data.sampleInfo || null);
      if (data.businessTypes?.length) setBusinessTypes(data.businessTypes);
      setPriceStats(data.priceStats || null);
      setLearningCurve(data.learningCurve || null);
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
        disc: w.supply_price > 0 ? (w.avg_selling_price - w.supply_price) / w.supply_price : 0,
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
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(90,21,21,0.06)', border: '1px solid rgba(90,21,21,0.05)', marginBottom: 24 }}>
        {/* 헤더 */}
        <div style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #faf9f7, #f5f0ed)', borderBottom: '1px solid rgba(90,21,21,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2c1810' }}>수입량 예측 분석</div>
            {/* 기존/신규 토글 */}
            <div style={{ display: 'flex', background: '#e8e4e0', borderRadius: 8, overflow: 'hidden' }}>
              {([{ v: false, label: '기존 품목' }, { v: true, label: '신규 품목' }] as const).map(opt => (
                <button key={String(opt.v)} onClick={() => { setIsNewItem(opt.v); setResults(null); }}
                  style={{
                    padding: '5px 14px', fontSize: 12, fontWeight: isNewItem === opt.v ? 700 : 500,
                    background: isNewItem === opt.v ? '#fff' : 'transparent',
                    color: isNewItem === opt.v ? '#5A1515' : '#8a8580',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isNewItem === opt.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    borderRadius: isNewItem === opt.v ? 6 : 0,
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
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  background: '#fff', color: '#2c7a3e', border: '1.5px solid #2c7a3e', borderRadius: 10,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                Excel
              </button>
            )}
            <button onClick={handleCalculate} disabled={!country || (!priceMin && !priceMax) || loading}
              style={{
                padding: '10px 28px', fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
                background: (!country || (!priceMin && !priceMax)) ? '#e0dbd7' : 'linear-gradient(135deg, #5A1515, #8B1538)',
                color: '#fff', border: 'none', borderRadius: 10,
                cursor: (!country || (!priceMin && !priceMax)) ? 'default' : 'pointer',
                boxShadow: (!country || (!priceMin && !priceMax)) ? 'none' : '0 2px 8px rgba(90,21,21,0.25)',
                transition: 'all 0.2s',
              }}>
              {loading ? '분석 중...' : '분석 실행'}
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 24px 16px' }}>
          {/* 국가 · 지역 · 타입 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>국가</label>
              <select value={country} onChange={e => { setCountry(e.target.value); setRegionLabel(''); setRegionSearch(''); setResults(null); }}
                style={selectStyle}>
                <option value="">국가 선택</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>지역 <span style={{ fontWeight: 400, color: '#ccc' }}>(선택)</span></label>
              <select value={regionLabel} onChange={e => handleRegionChange(e.target.value)} disabled={!country}
                style={{ ...selectStyle, opacity: country ? 1 : 0.5 }}>
                <option value="">전체 지역</option>
                {(REGIONS[country] || []).map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>타입 <span style={{ fontWeight: 400, color: '#ccc' }}>(선택)</span></label>
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
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #e8e4e0, transparent)', margin: '0 0 14px' }} />

          {/* 특판 제외 + 샘플 제외 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={excludeBulk} onChange={e => { setExcludeBulk(e.target.checked); setResults(null); }}
                  style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5A1515' }}>특판 제외</span>
              </label>
              <span style={{ fontSize: 11, color: '#a8a098' }}>1일 1거래처</span>
              <input type="number" value={bulkThreshold} onChange={e => { setBulkThreshold(Math.max(1, Number(e.target.value) || 60)); setResults(null); }}
                disabled={!excludeBulk}
                style={{ width: 52, padding: '4px 6px', fontSize: 12, fontWeight: 700, textAlign: 'center', border: '1.5px solid #e8e4e0', borderRadius: 6, outline: 'none', color: excludeBulk ? '#5A1515' : '#ccc', background: excludeBulk ? '#fff' : '#f5f3f0' }} />
              <span style={{ fontSize: 11, color: '#a8a098' }}>병 이상</span>
            </div>
            <div style={{ width: 1, height: 16, background: '#e8e4e0' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={excludeSamples} onChange={e => { setExcludeSamples(e.target.checked); setResults(null); }}
                style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5A1515' }}>샘플 제외</span>
              <span style={{ fontSize: 11, color: '#a8a098' }}>거래처당 1병·0원</span>
            </label>
            <div style={{ width: 1, height: 16, background: '#e8e4e0' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={noCorrection} onChange={e => { setNoCorrection(e.target.checked); setResults(null); }}
                style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5A1515' }}>보정 제외</span>
              <span style={{ fontSize: 11, color: '#a8a098' }}>재고소진·러닝커브 미적용</span>
            </label>
            <div style={{ width: 1, height: 16, background: '#e8e4e0' }} />
            {/* 업종 필터 */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setBizTypeOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: excludedBizTypes.size > 0 ? '#c0392b' : '#5A1515', background: '#fff', border: `1.5px solid ${excludedBizTypes.size > 0 ? '#e6a8a8' : '#e8e4e0'}`, borderRadius: 8, cursor: 'pointer' }}>
                업종 {excludedBizTypes.size > 0 ? `(${excludedBizTypes.size}개 제외)` : '(전체)'}
                <span style={{ fontSize: 10, color: '#aaa' }}>{bizTypeOpen ? '▲' : '▼'}</span>
              </button>
              {bizTypeOpen && (
                <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 20, background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: '8px 4px', minWidth: 180 }}>
                  {businessTypes.map(bt => {
                    const isExcluded = excludedBizTypes.has(bt);
                    return (
                      <label key={bt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', userSelect: 'none', borderRadius: 6, fontSize: 12, color: isExcluded ? '#c0b8b0' : '#2c1810' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f3f0')}
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
                          style={{ width: 14, height: 14, accentColor: '#5A1515', cursor: 'pointer' }} />
                        <span style={{ textDecoration: isExcluded ? 'line-through' : 'none' }}>{bt}</span>
                      </label>
                    );
                  })}
                  {excludedBizTypes.size > 0 && (
                    <div style={{ borderTop: '1px solid #f0ece8', marginTop: 4, paddingTop: 4 }}>
                      <button onClick={() => { setExcludedBizTypes(new Set()); setResults(null); }}
                        style={{ width: '100%', padding: '4px 12px', fontSize: 11, color: '#a8a098', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        전체 포함으로 초기화
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 공급가 + 분석 기간 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={labelStyle}>공급가 범위</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {PRICE_PRESETS.map(p => {
                  const isActive = priceMin === String(p.min) && priceMax === String(p.max);
                  return (
                    <button key={p.label} onClick={() => setPricePreset(p.min, p.max)}
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: isActive ? 700 : 500, borderRadius: 14, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: isActive ? 'linear-gradient(135deg, #5A1515, #8B1538)' : '#f5f3f0', color: isActive ? '#fff' : '#8a8580', boxShadow: isActive ? '0 2px 6px rgba(90,21,21,0.2)' : 'none' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="number" value={priceMin} onChange={e => { setPriceMin(e.target.value); setResults(null); }}
                    placeholder="0" style={{ ...inputStyle, paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#ccc' }}>원</span>
                </div>
                <div style={{ width: 12, height: 1.5, background: '#ddd', flexShrink: 0 }} />
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="number" value={priceMax} onChange={e => { setPriceMax(e.target.value); setResults(null); }}
                    placeholder="999,999" style={{ ...inputStyle, paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#ccc' }}>원</span>
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>분석 기간</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {YEAR_PRESETS.map(p => {
                  const isActive = startYear === String(p.start) && endYear === String(p.end);
                  return (
                    <button key={p.label} onClick={() => setYearPreset(p.start, p.end)}
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: isActive ? 700 : 500, borderRadius: 14, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: isActive ? 'linear-gradient(135deg, #5A1515, #8B1538)' : '#f5f3f0', color: isActive ? '#fff' : '#8a8580', boxShadow: isActive ? '0 2px 6px rgba(90,21,21,0.2)' : 'none' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={startYear} onChange={e => { setStartYear(e.target.value); setResults(null); }} style={{ ...selectStyle, flex: 1 }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <div style={{ width: 12, height: 1.5, background: '#ddd', flexShrink: 0 }} />
                <select value={endYear} onChange={e => { setEndYear(e.target.value); setResults(null); }} style={{ ...selectStyle, flex: 1 }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 선택 요약 */}
        {(country || priceMin) && (
          <div style={{ padding: '12px 24px', background: '#faf9f7', borderTop: '1px solid rgba(90,21,21,0.04)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#a8a098' }}>선택 조건:</span>
            <Tag>{isNewItem ? '신규 품목' : '기존 품목'}</Tag>
            {country && <Tag>{country}{regionLabel ? ` · ${regionLabel}` : ''}{wineType ? ` · ${wineType}` : ''}</Tag>}
            {priceMin && priceMax && <Tag>{Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원</Tag>}
            <Tag>{startYear}~{endYear}년</Tag>
          </div>
        )}
      </div>

      {message && (
        <div style={{ padding: 16, background: '#fffbeb', borderRadius: 12, fontSize: 13, color: '#92750c', marginBottom: 20, border: '1px solid #fde68a', lineHeight: 1.5 }}>
          {message}
        </div>
      )}

      {/* ── 재계산 바 ── */}
      {pendingRecalc && excludedWines.size > 0 && results !== null && (
        <div style={{
          position: 'sticky', top: 80, zIndex: 10, marginBottom: 16,
          padding: '12px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #fff3e0, #fff8e1)',
          border: '1px solid #ffe0b2',
          boxShadow: '0 4px 16px rgba(230,126,34,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e67e22' }}>{excludedWines.size}개 와인 제외됨</span>
            <span style={{ fontSize: 12, color: '#bf8f3e' }}>· 재계산하면 결과에 반영됩니다</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setExcludedWines(new Set()); setExcludedWineDetails([]); setPendingRecalc(false); }}
              style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, background: '#fff', border: '1px solid #e0dbd7', borderRadius: 8, cursor: 'pointer', color: '#8a8580' }}>
              초기화
            </button>
            <button onClick={handleRecalc} disabled={loading}
              style={{
                padding: '7px 20px', fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg, #e67e22, #f39c12)', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(230,126,34,0.3)',
              }}>
              {loading ? '계산 중...' : '재계산'}
            </button>
          </div>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <>
          {/* ── 요약 카드 ── */}
          <div style={{ background: 'linear-gradient(135deg, #3d0d0d 0%, #8B1538 50%, #5A1515 100%)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', borderRadius: '0 0 0 200px' }} />
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: '0.03em' }}>
              {isNewItem ? '신규' : '기존'} · {country}{regionLabel ? ` · ${regionLabel}` : ''}{wineType ? ` · ${wineType}` : ''} · 공급가 {Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원 ({priceRange?.label}) · {startYear}~{endYear} · 유사 {matchedItems}개 와인 기반{allMatchedItems > matchedItems ? ` (${allMatchedItems - matchedItems}개 제외)` : ''}
            </div>
            <div style={{ display: 'flex', gap: 40, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{displayTotal.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                  {isNewItem ? '1년차 예상' : '병 / 년 기대값'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{totalCases}</div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>케이스 (12병)</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{totalClients}<span style={{ fontSize: 14, opacity: 0.6 }}>곳</span></div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>판매 가능 거래처</div>
              </div>
              {isNewItem && (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{totalCorrected.toLocaleString()}<span style={{ fontSize: 14, opacity: 0.6 }}>병</span></div>
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>2년차~ 정상화</div>
                </div>
              )}
            </div>
          </div>

          {/* ── 시뮬레이션 ── */}
          <SimulationCard
            mergedData={mergedData}
            results={results}
            isNewItem={isNewItem}
            learningCurve={learningCurve}
            priceStats={priceStats}
          />

          {/* ── 보정 정보 배지 ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* 재고소진 보정 */}
            {stockoutInfo && stockoutInfo.correctedWines > 0 && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e67e22' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>
                    재고소진 보정 +{correctionPct}%
                  </div>
                  <div style={{ fontSize: 11, color: '#a8a098' }}>
                    {stockoutInfo.correctedWines}/{stockoutInfo.totalWines}개 와인 품절 감지 · 평균 ×{stockoutInfo.avgFactor} 보정
                  </div>
                </div>
              </div>
            )}
            {/* 러닝커브 */}
            {isNewItem && learningCurve && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3498db' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>
                    러닝커브 {Math.round(learningCurve.ratio * 100)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#a8a098' }}>
                    {learningCurve.sampleSize > 0
                      ? `${learningCurve.sampleSize}개 와인의 1년차 평균 성과`
                      : '데이터 부족 · 기본값 70% 적용'}
                  </div>
                </div>
              </div>
            )}
            {/* 유사 와인 분포 */}
            {activeData?.wine_distribution && activeData.wine_distribution.count >= 4 && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>
                    유사 와인 분포 ({activeData.manager})
                  </div>
                  <div style={{ fontSize: 11, color: '#a8a098' }}>
                    하위 {activeData.wine_distribution.p25}병 · 중위 {activeData.wine_distribution.median}병 · 상위 {activeData.wine_distribution.p75}병/년
                  </div>
                </div>
              </div>
            )}
            {/* 특판 제외 */}
            {bulkInfo && bulkInfo.excluded > 0 && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', cursor: 'pointer' }}
                onClick={() => setBulkOpen(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9b59b6', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>
                      특판 제외
                    </div>
                    <div style={{ fontSize: 11, color: '#a8a098' }}>
                      {bulkInfo.excluded}건 · {bulkInfo.qty.toLocaleString()}병 제외 (1일 {bulkInfo.threshold}병+)
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#b0a8a0', flexShrink: 0 }}>{bulkOpen ? '▲ 접기' : '▼ 상세'}</span>
                </div>
                {bulkOpen && bulkInfo.details.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #f0ece8', paddingTop: 8 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px 60px', gap: 4, fontSize: 10, fontWeight: 600, color: '#b0a8a0', marginBottom: 4 }}>
                      <div>날짜</div><div>거래처</div><div>와인</div><div style={{ textAlign: 'right' }}>수량</div><div style={{ textAlign: 'right' }}>담당</div>
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {bulkInfo.details.map((d, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px 60px', gap: 4, fontSize: 11, color: '#2c1810', padding: '4px 0', borderBottom: i < bulkInfo.details.length - 1 ? '1px solid #f8f6f4' : 'none' }}>
                          <div style={{ color: '#8a8580' }}>{d.date}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.wine}</div>
                          <div style={{ textAlign: 'right', fontWeight: 700, color: '#9b59b6' }}>{d.qty}병</div>
                          <div style={{ textAlign: 'right', color: '#8a8580' }}>{d.manager}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* 샘플 제외 */}
            {sampleInfo && sampleInfo.excluded > 0 && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#95a5a6' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>샘플 제외</div>
                  <div style={{ fontSize: 11, color: '#a8a098' }}>
                    {sampleInfo.excluded}건 · {sampleInfo.qty}병 (0원 출고 + 1병 미재주문)
                  </div>
                </div>
              </div>
            )}
            {/* 평균 공급가 */}
            {priceStats && priceStats.avg > 0 && (
              <div style={{ padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34495e' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810' }}>
                    평균 공급가 {priceStats.avg.toLocaleString()}원
                  </div>
                  <div style={{ fontSize: 11, color: '#a8a098' }}>
                    {priceStats.min.toLocaleString()} ~ {priceStats.max.toLocaleString()}원
                  </div>
                </div>
              </div>
            )}
          </div>

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
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e4e0', padding: '14px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2c1810', marginBottom: 2 }}>
                  판매 트렌드 ({trend.prevYear}→{trend.year})
                </div>
                <div style={{ fontSize: 10, color: '#b0a8a0', marginBottom: 8 }}>전사 전체 와인 출고 기준 전년 대비 성장률</div>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {/* 전체 버튼 */}
            {(() => {
              const isActive = activeManager === '__all__';
              return (
                <button onClick={() => { setActiveManager('__all__'); setDetailTab('wines'); }}
                  style={{
                    padding: '12px 18px', borderRadius: 12, border: isActive ? '2px solid #2c1810' : '1px solid #e8e4e0',
                    background: isActive ? '#f5f3f0' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? '#2c1810' : '#8a8580' }}>전체</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: '#5A1515', fontWeight: 700 }}>{displayTotal}병</span>
                    <span style={{ color: '#a8a098' }}>{totalClients}곳</span>
                  </div>
                </button>
              );
            })()}
            <div style={{ width: 1, background: '#e8e4e0', flexShrink: 0 }} />
            {results.map(r => {
              const isActive = activeManager === r.manager;
              const displayQty = isNewItem ? (r.qty_per_item_year1 ?? r.qty_per_item) : r.qty_per_item;
              return (
                <button key={r.manager} onClick={() => { setActiveManager(r.manager); setDetailTab('wines'); }}
                  style={{
                    padding: '12px 18px', borderRadius: 12, border: isActive ? '2px solid #5A1515' : '1px solid #e8e4e0',
                    background: isActive ? '#faf5f6' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 2px 8px rgba(90,21,21,0.1)' : '0 1px 2px rgba(0,0,0,0.04)',
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? '#5A1515' : '#2c1810' }}>{r.manager}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: '#5A1515', fontWeight: 700 }}>{displayQty}병</span>
                    {isNewItem && <span style={{ color: '#3498db', fontSize: 11 }}>→{r.qty_per_item}병(2년차)</span>}
                    <span style={{ color: '#a8a098' }}>{r.avg_clients}곳</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── 선택된 영업사원 상세 ── */}
          {activeData && (
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid rgba(90,21,21,0.06)', overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #f0ece8', background: '#faf9f7' }}>
                {([
                  { id: 'wines' as const, label: `판매 와인 (${activeData.wine_details?.length || 0})` },
                  { id: 'years' as const, label: '연도별 추이' },
                  { id: 'clients' as const, label: `주요 거래처 (${activeData.top_clients?.length || 0})` },
                  { id: 'channels' as const, label: `채널별 (${activeData.channels?.length || 0})` },
                ]).map(tab => (
                  <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                    style={{
                      padding: '12px 20px', fontSize: 13, fontWeight: detailTab === tab.id ? 700 : 500,
                      color: detailTab === tab.id ? '#5A1515' : '#8a8580', background: 'transparent', border: 'none',
                      borderBottom: detailTab === tab.id ? '2px solid #5A1515' : '2px solid transparent',
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
                  {/* 헤더: 전체선택 + 선택 제외 안내 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', borderBottom: '1px solid #f0ece8', background: '#faf9f7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={toggleAll} style={{ width: 15, height: 15, accentColor: '#5A1515', cursor: 'pointer' }} />
                      <span style={{ fontSize: 11, color: '#8a8580' }}>
                        {checkedCount > 0 ? `${checkedCount}개 선택됨` : '전체 선택'}
                      </span>
                    </div>
                    {checkedCount > 0 && (
                      <span style={{ fontSize: 11, color: '#e67e22', fontWeight: 600 }}>
                        체크한 와인은 재계산 시 제외됩니다
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 60px 60px 110px', padding: '6px 20px', fontSize: 11, color: '#b0a8a0', fontWeight: 600, borderBottom: '1px solid #f0ece8' }}>
                    <div></div>
                    <div>와인명</div>
                    <div style={{ textAlign: 'right' }}>공급가</div>
                    <div style={{ textAlign: 'right' }}>평균공급가</div>
                    <div style={{ textAlign: 'right' }}>거래처</div>
                    <div style={{ textAlign: 'right' }}>연수</div>
                    <div style={{ textAlign: 'right' }}>총 판매</div>
                  </div>
                  {activeData.wine_details.map((w, i) => {
                    const maxQty = activeData.wine_details?.[0]?.corrected_qty || 1;
                    const pct = Math.round((w.corrected_qty / maxQty) * 100);
                    const hasStockout = w.stockout_factor > 1;
                    const isChecked = excludedWines.has(w.item_name);
                    return (
                      <div key={w.item_code} style={{ position: 'relative', borderBottom: i < (activeData.wine_details?.length || 1) - 1 ? '1px solid #f8f6f4' : 'none', opacity: isChecked ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                        <div style={{ position: 'absolute', left: 36, top: 0, bottom: 0, width: `calc(${pct}% - 36px)`, background: isChecked ? 'rgba(200,200,200,0.08)' : 'linear-gradient(90deg, rgba(90,21,21,0.04), rgba(90,21,21,0.01))', transition: 'width 0.3s' }} />
                        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 60px 60px 110px', padding: '10px 20px', alignItems: 'center' }}>
                          <div>
                            <input type="checkbox" checked={isChecked}
                              onChange={() => toggleExcludeWine(w.item_name, { supply_price: w.supply_price, region: w.region })}
                              style={{ width: 15, height: 15, accentColor: '#c0392b', cursor: 'pointer' }} />
                          </div>
                          <div style={{ cursor: 'pointer' }} onClick={() => handleWineClick(w.item_name, w.item_code)}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isChecked ? '#aaa' : '#2c1810', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6, textDecoration: isChecked ? 'line-through' : 'none' }}>
                              {w.item_name}
                              {hasStockout && !isChecked && (
                                <span style={{ fontSize: 9, padding: '1px 5px', background: '#fef3e2', color: '#e67e22', borderRadius: 4, fontWeight: 700 }}>
                                  품절보정 ×{w.stockout_factor}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: expandedWine === w.item_name ? '#5A1515' : '#ccc' }}>{expandedWine === w.item_name ? '▲' : '▼'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#b0a8a0', marginTop: 2 }}>
                              {w.item_code}{w.region ? ` · ${w.region}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580' }}>{w.supply_price?.toLocaleString()}</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: '#2c1810', fontWeight: 600 }}>{w.avg_selling_price?.toLocaleString()}</div>
                            {w.avg_selling_price !== w.supply_price && (
                              <div style={{ fontSize: 10, color: w.avg_selling_price < w.supply_price ? '#e67e22' : '#27ae60' }}>
                                {w.avg_selling_price < w.supply_price ? '' : '+'}{Math.round((w.avg_selling_price - w.supply_price) / w.supply_price * 100)}%
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580' }}>{w.client_count}곳</div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580' }}>{w.years_sold}년</div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: isChecked ? '#bbb' : '#5A1515' }}>{w.corrected_qty.toLocaleString()}</span>
                            <span style={{ fontSize: 11, color: '#b0a8a0' }}>병</span>
                            {hasStockout && !isChecked && (
                              <span style={{ fontSize: 10, color: '#b0a8a0', textDecoration: 'line-through', marginLeft: 4 }}>{w.total_qty.toLocaleString()}</span>
                            )}
                            <div style={{ fontSize: 10, color: '#b0a8a0' }}>연평균 {w.annual_avg_corrected}</div>
                          </div>
                        </div>
                        {/* 출고 상세 이력 */}
                        {expandedWine === w.item_name && (
                          <div style={{ padding: '0 20px 12px 56px', background: '#faf9f7' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                            {shipLoading ? (
                              <div style={{ padding: 12, fontSize: 12, color: '#a8a098' }}>조회 중...</div>
                            ) : wineShipments.length === 0 ? (
                              <div style={{ padding: 12, fontSize: 12, color: '#a8a098' }}>출고 이력이 없습니다</div>
                            ) : (
                              (() => {
                                const LIMIT = 10;
                                const showSlice = shipShowAll ? wineShipments : wineShipments.slice(0, LIMIT);
                                const hasMore = wineShipments.length > LIMIT;
                                const renderRow = (s: typeof wineShipments[0], si: number, len: number) => (
                                  <div key={si} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 80px 60px', gap: 4, fontSize: 11, padding: '5px 0', borderBottom: si < len - 1 ? '1px solid #f5f3f0' : 'none', alignItems: 'center' }}>
                                    <div style={{ color: '#8a8580' }}>{s.date}</div>
                                    <div style={{ color: '#2c1810', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client}</div>
                                    <div style={{ textAlign: 'right', color: s.price > 0 && s.price < w.supply_price ? '#e67e22' : '#8a8580', fontWeight: 600 }}>
                                      {s.price > 0 ? s.price.toLocaleString() : '-'}
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#5A1515' }}>{s.qty}병</div>
                                    <div style={{ textAlign: 'right', color: '#a8a098', fontSize: 10 }}>{s.manager}</div>
                                  </div>
                                );
                                return (
                                  <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 80px 60px', gap: 4, fontSize: 10, fontWeight: 600, color: '#b0a8a0', padding: '8px 0 4px', borderBottom: '1px solid #e8e4e0' }}>
                                      <div>날짜</div><div>거래처</div><div style={{ textAlign: 'right' }}>공급가</div><div style={{ textAlign: 'right' }}>수량</div><div style={{ textAlign: 'right' }}>담당</div>
                                    </div>
                                    {shipShowAll ? (
                                      <div ref={scrollRef} style={{ height: 400, overflowY: 'scroll', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'relative', zIndex: 2 }}>
                                        {showSlice.map((s, si) => renderRow(s, si, showSlice.length))}
                                      </div>
                                    ) : (
                                      <div>
                                        {showSlice.map((s, si) => renderRow(s, si, showSlice.length))}
                                      </div>
                                    )}
                                    <div style={{ padding: '8px 0 0', fontSize: 11, color: '#a8a098', borderTop: '1px solid #e8e4e0', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>총 {wineShipments.reduce((s, r) => s + r.qty, 0)}병 · {wineShipments.length}건</span>
                                      {hasMore && (
                                        <button
                                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setShipShowAll(v => !v); }}
                                          style={{ fontSize: 11, fontWeight: 600, color: '#5A1515', background: '#fff', border: '1px solid #e0dbd7', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', position: 'relative', zIndex: 5 }}>
                                          {shipShowAll ? '10건만 보기' : `전체 ${wineShipments.length}건 보기`}
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

                  {/* 제외된 와인 목록 (이전 재계산에서 이미 제외된 것들) */}
                  {excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).length > 0 && (
                    <div style={{ borderTop: '2px dashed #e8e4e0', background: '#fafafa' }}>
                      <div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 600, color: '#b0a8a0' }}>
                        이전 제외 ({excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).length})
                      </div>
                      {excludedWineDetails.filter(ew => !wineNames.includes(ew.item_name)).map((ew, idx) => (
                        <div key={`excl-${idx}`} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px', padding: '8px 20px', alignItems: 'center', opacity: 0.5 }}>
                          <div>
                            <input type="checkbox" checked={true}
                              onChange={() => toggleExcludeWine(ew.item_name)}
                              style={{ width: 15, height: 15, accentColor: '#c0392b', cursor: 'pointer' }} />
                          </div>
                          <div style={{ fontSize: 12, color: '#8a8580', textDecoration: 'line-through' }}>{ew.item_name}</div>
                          <div style={{ textAlign: 'right', fontSize: 11, color: '#b0a8a0' }}>{ew.supply_price?.toLocaleString()}원</div>
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', marginBottom: 12 }}>연도별 판매량 (보정 적용)</div>
                    {details.map(yd => {
                      const pct = Math.round((yd.correctedQty / maxQ) * 100);
                      const w = getWeight(yd.year);
                      const weightColors = ['', '#e8e4e0', '#c4925a', '#5A1515'];
                      const hasDiff = yd.correctedQty !== yd.qty;
                      return (
                        <div key={yd.year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 40, fontSize: 14, fontWeight: 700, color: '#2c1810' }}>{yd.year}</div>
                          {!singleYear && <div style={{ width: 30, textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: weightColors[w], background: w === 3 ? '#faf5f6' : w === 2 ? '#fef7ed' : '#f5f5f5', padding: '2px 6px', borderRadius: 4, border: `1px solid ${w === 3 ? '#5A1515' : w === 2 ? '#c4925a' : '#e8e4e0'}` }}>×{w}</span>
                          </div>}
                          <div style={{ flex: 1, height: 32, background: '#f5f3f0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: w === 3 ? 'linear-gradient(90deg, #5A1515, #8B1538)' : w === 2 ? 'linear-gradient(90deg, #b87333, #c4925a)' : 'linear-gradient(90deg, #bbb, #ccc)', borderRadius: 8, transition: 'width 0.4s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: pct > 40 ? '#fff' : '#2c1810' }}>
                              {yd.correctedQty.toLocaleString()}병
                              {hasDiff && <span style={{ fontSize: 10, opacity: 0.7 }}> (실 {yd.qty.toLocaleString()})</span>}
                            </div>
                          </div>
                          <div style={{ width: 100, fontSize: 11, color: '#8a8580', textAlign: 'right' }}>
                            {yd.items}와인 · {yd.clients}거래처
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ height: 1, background: '#e8e4e0', margin: '20px 0' }} />

                    <div style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', marginBottom: 12 }}>와인당 판매량 (= 기대값 산출 근거)</div>
                    {details.map(yd => {
                      const pct = Math.round((yd.qtyPerItemCorrected / maxPerItem) * 100);
                      const w = getWeight(yd.year);
                      return (
                        <div key={yd.year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 40, fontSize: 14, fontWeight: 700, color: '#2c1810' }}>{yd.year}</div>
                          {!singleYear && <div style={{ width: 30, textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: w === 3 ? '#5A1515' : w === 2 ? '#c4925a' : '#aaa' }}>×{w}</span>
                          </div>}
                          <div style={{ flex: 1, height: 32, background: '#f5f3f0', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: w === 3 ? 'linear-gradient(90deg, #5A1515, #8B1538)' : w === 2 ? 'linear-gradient(90deg, #b87333, #c4925a)' : 'linear-gradient(90deg, #bbb, #ccc)', borderRadius: 8, transition: 'width 0.4s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: pct > 40 ? '#fff' : '#2c1810' }}>
                              {yd.correctedQty.toLocaleString()} ÷ {isNewItem ? `(${yd.items}+1)` : yd.items} = {yd.qtyPerItemCorrected}병
                            </div>
                          </div>
                          {!singleYear && <div style={{ width: 100, fontSize: 12, color: '#8a8580', textAlign: 'right' }}>
                            {yd.qtyPerItemCorrected} × {w} = <strong style={{ color: '#5A1515' }}>{yd.qtyPerItemCorrected * w}</strong>
                          </div>}
                        </div>
                      );
                    })}

                    {/* 가중 평균 계산 + 보정 과정 */}
                    <div style={{ marginTop: 20, padding: '16px 18px', background: '#faf5f6', borderRadius: 10, border: '1px solid rgba(90,21,21,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#5A1515', marginBottom: 10 }}>{singleYear ? '기대값 산출' : '가중 평균 계산'}</div>

                      {/* 산출 근거 설명 */}
                      <div style={{ fontSize: 12, color: '#8a8580', lineHeight: 1.8, marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #f0ece8' }}>
                        <div>총 판매량(보정): <strong style={{ color: '#2c1810' }}>{activeData.avg_annual_qty_corrected.toLocaleString()}병</strong></div>
                        <div>판매 와인 수: <strong style={{ color: '#2c1810' }}>{activeData.avg_items}개</strong></div>
                        {isNewItem ? (
                          <>
                            <div>기대값 = 총 판매량 ÷ (와인 수 + <span style={{ color: '#e67e22' }}>신규 1개</span>) = {activeData.avg_annual_qty_corrected.toLocaleString()} ÷ {activeData.avg_items + 1} = <strong style={{ color: '#5A1515' }}>{activeData.qty_per_item}병</strong></div>
                            <div style={{ fontSize: 11, color: '#b0a8a0', marginTop: 4 }}>"+1"은 신규 와인 1개를 추가했을 때 기존 와인들과 나눠 갖는 판매량</div>
                          </>
                        ) : (
                          <div>와인당 평균 = 총 판매량 ÷ 와인 수 = {activeData.avg_annual_qty_corrected.toLocaleString()} ÷ {activeData.avg_items} = <strong style={{ color: '#5A1515' }}>{activeData.qty_per_item}병</strong></div>
                        )}
                      </div>

                      {!singleYear && (
                        <div style={{ fontSize: 13, color: '#2c1810', lineHeight: 2, fontFamily: "'SF Mono', 'Consolas', monospace", marginBottom: 8 }}>
                          <div style={{ color: '#8a8580', fontSize: 11, marginBottom: 4 }}>연도별 와인당 판매량의 가중 평균</div>
                          <div>
                            ({details.map(yd => `${yd.qtyPerItemCorrected}×${getWeight(yd.year)}`).join(' + ')})
                          </div>
                          <div>÷ ({details.map(yd => getWeight(yd.year)).join(' + ')}) = ÷ {totalWeight}</div>
                          <div style={{ marginTop: 4 }}>
                            = {details.reduce((s, yd) => s + yd.qtyPerItemCorrected * getWeight(yd.year), 0)} ÷ {totalWeight}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: '#8a8580' }}>{isNewItem ? '정상화 기대값 =' : '기대값 ='}</span>
                        <span style={{ fontSize: 28, fontWeight: 800, color: '#5A1515' }}>{activeData.qty_per_item}</span>
                        <span style={{ fontSize: 14, color: '#5A1515' }}>병/년</span>
                        {Math.abs(activeData.qty_per_item - activeData.qty_per_item_raw) >= 5 && (
                          <span style={{ fontSize: 12, color: '#e67e22' }}>(품절보정 전 {activeData.qty_per_item_raw})</span>
                        )}
                      </div>

                      {/* 러닝커브 적용 */}
                      {isNewItem && learningCurve && activeData.qty_per_item_year1 !== null && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#eef6ff', borderRadius: 8, border: '1px solid #bdd9f7' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#2c6faa', marginBottom: 4 }}>러닝커브 적용 (1년차)</div>
                          <div style={{ fontSize: 13, fontFamily: "'SF Mono', 'Consolas', monospace", color: '#2c1810' }}>
                            {activeData.qty_per_item} × {Math.round(learningCurve.ratio * 100)}% = <strong style={{ color: '#3498db', fontSize: 16 }}>{activeData.qty_per_item_year1}병</strong>
                          </div>
                          {learningCurve.sampleSize > 0 && (
                            <div style={{ fontSize: 11, color: '#7faed4', marginTop: 4 }}>
                              근거: {learningCurve.details.slice(0, 3).map(d => `${d.name.substring(0, 8)}… ${Math.round(d.ratio * 100)}%`).join(', ')} 등 {learningCurve.sampleSize}개 와인
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: '#8a8580' }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#5A1515', marginRight: 4, verticalAlign: 'middle' }} />최근 연도 ×3</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#c4925a', marginRight: 4, verticalAlign: 'middle' }} />직전 연도 ×2</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ccc', marginRight: 4, verticalAlign: 'middle' }} />나머지 ×1</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 주요 거래처 */}
              {detailTab === 'clients' && activeData.top_clients && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 90px 80px 80px', padding: '10px 20px', fontSize: 11, color: '#b0a8a0', fontWeight: 600, borderBottom: '1px solid #f0ece8' }}>
                    <div>#</div><div>거래처명</div><div>업종</div><div style={{ textAlign: 'right' }}>품목수</div><div style={{ textAlign: 'right' }}>총 구매</div>
                  </div>
                  {activeData.top_clients.map((c, i) => (
                    <div key={c.client_name} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 90px 80px 80px', padding: '10px 20px', borderBottom: i < (activeData.top_clients?.length || 1) - 1 ? '1px solid #f8f6f4' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? '#5A1515' : '#b0a8a0' }}>{i + 1}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#2c1810' }}>{c.client_name}</div>
                      <div style={{ fontSize: 11, color: '#a8a098' }}>{c.business_type || ''}</div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580' }}>{c.item_count}개</div>
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#5A1515' }}>{c.total_qty.toLocaleString()}병</div>
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
                    {/* 채널 바 차트 */}
                    {chs.map((ch, i) => {
                      const pct = Math.round(ch.qty / maxQty * 100);
                      const color = channelColors[ch.channel] || '#8a8580';
                      return (
                        <div key={ch.channel} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>{ch.channel}</span>
                              <span style={{ fontSize: 11, color: '#a8a098' }}>{ch.pct}%</span>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8a8580' }}>
                              <span>{ch.clients}거래처</span>
                              <span>{ch.wines}와인</span>
                              <span style={{ fontWeight: 700, color }}>{ch.annual_qty.toLocaleString()}병/년</span>
                            </div>
                          </div>
                          <div style={{ height: 24, background: '#f5f3f0', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 6, transition: 'width 0.3s', minWidth: 4 }} />
                            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: pct > 35 ? '#fff' : '#2c1810' }}>
                              {ch.qty.toLocaleString()}병
                            </div>
                          </div>
                          {/* 와인당 기대값 */}
                          <div style={{ fontSize: 11, color: '#a8a098', marginTop: 3, textAlign: 'right' }}>
                            와인당 {ch.qty_per_wine}병/년{isNewItem ? ' (신규+1 포함)' : ''}
                          </div>
                        </div>
                      );
                    })}

                    {/* 채널 요약 */}
                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#faf9f7', borderRadius: 8, border: '1px solid #f0ece8' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', marginBottom: 8 }}>채널별 신규 와인 기대값</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {chs.filter(c => c.qty_per_wine > 0).map(ch => {
                          const color = channelColors[ch.channel] || '#8a8580';
                          return (
                            <div key={ch.channel} style={{ padding: '6px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                              <span style={{ fontSize: 12, color: '#2c1810' }}>{ch.channel}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color }}>{ch.qty_per_wine}병</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: '#b0a8a0', marginTop: 8 }}>
                        신규 와인이 주로 진입할 채널에 따라 기대값이 달라집니다
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 산출 기준 */}
          <div style={{ padding: 16, background: '#faf9f7', borderRadius: 12, border: '1px solid #f0ece8', fontSize: 12, color: '#a8a098', lineHeight: 1.8 }}>
            <strong style={{ color: '#8a8580' }}>산출 기준</strong> — {startYear}~{endYear} 출고 데이터, 공급가 {Number(priceMin).toLocaleString()}~{Number(priceMax).toLocaleString()}원, 매칭 {matchedItems}개 품목 기반.
            {stockoutInfo && stockoutInfo.correctedWines > 0 && (
              <> <strong style={{ color: '#e67e22' }}>재고소진 보정</strong>: {stockoutInfo.correctedWines}개 와인의 품절 기간 감지, 잠재수요 반영 (평균 ×{stockoutInfo.avgFactor}).</>
            )}
            {isNewItem && learningCurve && (
              <> <strong style={{ color: '#3498db' }}>러닝커브</strong>: 동일 조건 {learningCurve.sampleSize}개 와인의 1년차 평균 성과율 {Math.round(learningCurve.ratio * 100)}% 적용.</>
            )}
            {' '}유사 와인의 영업사원별 실적에 기반한 {isNewItem ? '신규' : '기존'} 품목 판매 예측. 프로모션·시즌·경쟁 고려하여 조정 필요.
          </div>
        </>
      )}

      {results !== null && results.length === 0 && !message && (
        <div style={{ textAlign: 'center', padding: 60, color: '#b0a8a0', fontSize: 14, background: '#fff', borderRadius: 14, border: '1px solid #f0ece8' }}>
          해당 조건의 판매 이력이 없습니다.<br /><span style={{ fontSize: 12 }}>지역을 비우거나 가격대를 조정해 보세요.</span>
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
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
      background: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#5A1515',
      border: '1px solid rgba(90,21,21,0.1)', letterSpacing: '-0.01em',
    }}>
      {children}
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6b5e54', marginBottom: 5, display: 'block',
  letterSpacing: '-0.01em',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1.5px solid #e8e4e0', borderRadius: 8, background: '#fafafa', outline: 'none',
  color: '#2c1810', appearance: 'none' as const, WebkitAppearance: 'none' as const,
  transition: 'border-color 0.2s',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1.5px solid #e8e4e0', borderRadius: 8, outline: 'none',
  boxSizing: 'border-box', color: '#2c1810', background: '#fafafa',
  transition: 'border-color 0.2s',
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

  const wines = (mergedData.wine_details || [])
    .map(w => ({ name: w.item_name, annual: w.annual_avg_corrected, price: w.avg_selling_price }))
    .filter(w => w.annual >= 6)
    .sort((a, b) => a.annual - b.annual);
  if (wines.length === 0) return null;

  const lc = (isNewItem && learningCurve) ? learningCurve.ratio : 1;
  const p25Idx = Math.max(0, Math.floor(wines.length * 0.25));
  const medIdx = Math.floor(wines.length * 0.5);
  const p75Idx = Math.min(wines.length - 1, Math.floor(wines.length * 0.75));
  const medVal = wines[medIdx].annual;
  // 낙관적: P75지만 중위값의 2배 이내로 제한 (히트 와인 왜곡 방지)
  const p75Raw = wines[p75Idx].annual;
  const p75Capped = Math.min(p75Raw, Math.round(medVal * 2));
  // 보수적: P25지만 중위값의 50% 이상 유지
  const p25Raw = wines[p25Idx].annual;
  const p25Capped = Math.max(p25Raw, Math.round(medVal * 0.5));

  const scenarios = [
    { label: '보수적', value: p25Capped, color: '#95a5a6', icon: '▽' },
    { label: '기본', value: medVal, color: '#5A1515', icon: '■' },
    { label: '낙관적', value: p75Capped, color: '#27ae60', icon: '△' },
  ];
  if (wines.length === 1) {
    scenarios.splice(0, scenarios.length,
      { label: '보수적', value: Math.round(wines[0].annual * 0.7), color: '#95a5a6', icon: '▽' },
      { label: '기본', value: wines[0].annual, color: '#5A1515', icon: '■' },
      { label: '낙관적', value: Math.round(wines[0].annual * 1.3), color: '#27ae60', icon: '△' },
    );
  } else if (wines.length === 2) {
    scenarios.splice(0, scenarios.length,
      { label: '보수적', value: wines[0].annual, color: '#95a5a6', icon: '▽' },
      { label: '기본', value: Math.round((wines[0].annual + wines[1].annual) / 2), color: '#5A1515', icon: '■' },
      { label: '낙관적', value: wines[1].annual, color: '#27ae60', icon: '△' },
    );
  }

  const importBottles = importCases * 12;
  const totalInvestment = importBottles * costPrice;
  const sellingPrice = Math.round(costPrice * (1 + marginPct / 100));

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(90,21,21,0.06)', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0ece8', background: '#faf9f7' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2c1810' }}>투자 시뮬레이션</div>
        <div style={{ fontSize: 11, color: '#a8a098' }}>수입 물량과 수입원가 마진율을 조정하여 시나리오별 수익성을 분석합니다</div>
      </div>

      {/* 입력 */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 20, flexWrap: 'wrap', borderBottom: '1px solid #f0ece8' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b5e54', marginBottom: 4 }}>수입량 (케이스)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={100} value={importCases} onChange={e => setImportCases(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#5A1515' }} />
            <input type="number" value={importCases} onChange={e => setImportCases(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 52, padding: '4px 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', border: '1.5px solid #e8e4e0', borderRadius: 6, color: '#5A1515' }} />
          </div>
          <div style={{ fontSize: 11, color: '#a8a098', marginTop: 2 }}>{importBottles.toLocaleString()}병 · 투자 {(totalInvestment / 10000).toLocaleString()}만원</div>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b5e54', marginBottom: 4 }}>수입원가 (원)</div>
          <input type="number" value={costPrice} onChange={e => setCostPrice(Number(e.target.value) || 0)}
            style={{ width: '100%', padding: '6px 10px', fontSize: 13, border: '1.5px solid #e8e4e0', borderRadius: 6, color: '#2c1810' }} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b5e54', marginBottom: 4 }}>마진율 (%)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={5} max={60} value={marginPct} onChange={e => setMarginPct(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#5A1515' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#5A1515', minWidth: 36 }}>{marginPct}%</span>
          </div>
          <div style={{ fontSize: 11, color: '#a8a098', marginTop: 2 }}>판매가 {sellingPrice.toLocaleString()}원</div>
        </div>
      </div>

      {/* 시나리오별 결과 */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
          {scenarios.map(s => {
            const yr1Sales = Math.round(s.value * lc);
            const yr1Revenue = yr1Sales * sellingPrice;
            const yr1Profit = yr1Sales * (sellingPrice - costPrice);
            const sellThruPct = Math.min(100, Math.round(yr1Sales / importBottles * 100));
            const remainBottles = Math.max(0, importBottles - yr1Sales);
            const roi = totalInvestment > 0 ? Math.round(yr1Profit / totalInvestment * 100) : 0;
            const monthsToSell = yr1Sales > 0 ? Math.round(importBottles / yr1Sales * 12) : 999;

            return (
              <div key={s.label} style={{ padding: 16, borderRadius: 10, border: `1.5px solid ${s.color}33`, background: `${s.color}08` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{s.icon}</span> {s.label}
                  <span style={{ fontSize: 10, fontWeight: 400, color: '#a8a098', marginLeft: 'auto' }}>{s.value}병/년</span>
                </div>

                <div style={{ fontSize: 11, color: '#8a8580', lineHeight: 2.2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{isNewItem ? '1년차 판매' : '연간 판매'}</span>
                    <strong style={{ color: '#2c1810' }}>{yr1Sales.toLocaleString()}병</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>매출</span>
                    <strong style={{ color: '#2c1810' }}>{(yr1Revenue / 10000).toLocaleString()}만원</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>수익</span>
                    <strong style={{ color: yr1Profit >= 0 ? '#27ae60' : '#c0392b' }}>{yr1Profit >= 0 ? '+' : ''}{(yr1Profit / 10000).toLocaleString()}만원</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ROI</span>
                    <strong style={{ color: roi >= 0 ? '#27ae60' : '#c0392b' }}>{roi >= 0 ? '+' : ''}{roi}%</strong>
                  </div>

                  {/* 소진 바 */}
                  <div style={{ marginTop: 6, marginBottom: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#b0a8a0' }}>
                      <span>소진율</span>
                      <span>{sellThruPct}% · 잔여 {remainBottles}병</span>
                    </div>
                    <div style={{ height: 6, background: '#f0ece8', borderRadius: 3, marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${sellThruPct}%`, background: sellThruPct >= 80 ? '#27ae60' : sellThruPct >= 50 ? '#e67e22' : '#c0392b', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span>완전소진</span>
                    <strong style={{ color: monthsToSell <= 12 ? '#27ae60' : monthsToSell <= 24 ? '#e67e22' : '#c0392b' }}>
                      {monthsToSell >= 999 ? '-' : `약 ${monthsToSell}개월`}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 근거 와인 */}
        <div style={{ borderTop: '1px solid #f0ece8', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', marginBottom: 8 }}>근거: 유사 와인 {wines.length}개 연평균 판매량 분포</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {wines.map((w, i) => {
              const sColor = i <= p25Idx ? '#95a5a6' : i >= p75Idx ? '#27ae60' : '#5A1515';
              return (
                <div key={i} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: `${sColor}11`, border: `1px solid ${sColor}33`, color: '#2c1810', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                  <span style={{ fontWeight: 700, color: sColor }}>{w.annual}</span>
                </div>
              );
            })}
          </div>
        </div>
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
    <div style={{ marginTop: 32 }}>
      <button onClick={loadBrands}
        style={{ width: '100%', padding: '14px 24px', background: '#fff', borderRadius: 14, border: '1px solid #e8e4e0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', textAlign: 'left' }}>브랜드별 소진 속도 분석</div>
          <div style={{ fontSize: 11, color: '#a8a098', textAlign: 'left', marginTop: 2 }}>과거 데이터 기반 브랜드별 월평균 판매량, 소진 기간, 패턴</div>
        </div>
        <span style={{ fontSize: 12, color: '#a8a098' }}>{loading ? '로딩...' : open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && brands.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', border: '1px solid #e8e4e0', borderTop: 'none', padding: '16px 0' }}>
          {/* 필터/정렬 */}
          <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#8a8580' }}>가격대:</span>
            {['all', '~2만', '2~5만', '5~10만', '10만~'].map(p => (
              <button key={p} onClick={() => setFilterPrice(p)}
                style={{ padding: '3px 10px', fontSize: 11, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: filterPrice === p ? 700 : 400, background: filterPrice === p ? '#5A1515' : '#f5f3f0', color: filterPrice === p ? '#fff' : '#8a8580' }}>
                {p === 'all' ? '전체' : p}
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: '#e8e4e0', margin: '0 4px' }} />
            <span style={{ fontSize: 11, color: '#8a8580' }}>정렬:</span>
            {([['total', '총판매'], ['monthlyAvg', '월평균'], ['avgPrice', '평균가'], ['items', '품목수']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSortKey(k)}
                style={{ padding: '3px 10px', fontSize: 11, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: sortKey === k ? 700 : 400, background: sortKey === k ? '#5A1515' : '#f5f3f0', color: sortKey === k ? '#fff' : '#8a8580' }}>
                {l}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#b0a8a0', marginLeft: 'auto' }}>{filtered.length}개 브랜드</span>
          </div>

          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 55px 70px 65px 55px 55px 55px 60px', padding: '8px 20px', fontSize: 10, color: '#b0a8a0', fontWeight: 600, borderBottom: '1px solid #f0ece8' }}>
            <div>브랜드</div><div style={{ textAlign: 'right' }}>품목</div><div style={{ textAlign: 'right' }}>평균가</div>
            <div style={{ textAlign: 'right' }}>총판매</div><div style={{ textAlign: 'right' }}>월평균</div>
            <div style={{ textAlign: 'center' }}>5cs</div><div style={{ textAlign: 'center' }}>10cs</div><div style={{ textAlign: 'center' }}>20cs</div>
            <div style={{ textAlign: 'center' }}>패턴</div>
          </div>

          {/* 데이터 */}
          {filtered.map((b, i) => {
            const maxAvg = filtered[0]?.monthlyAvg || 1;
            const pct = Math.min(100, Math.round(b.monthlyAvg / maxAvg * 100));
            return (
              <div key={b.brand} style={{ position: 'relative', borderBottom: '1px solid #f8f6f4' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg, rgba(90,21,21,0.04), rgba(90,21,21,0.01))' }} />
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 50px 55px 70px 65px 55px 55px 55px 60px', padding: '10px 20px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>{b.brand}</div>
                    <div style={{ fontSize: 10, color: '#b0a8a0' }}>{b.country}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#8a8580' }}>{b.items}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#8a8580' }}>{b.avgPrice > 0 ? (b.avgPrice / 1000).toFixed(0) + 'k' : '-'}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#5A1515' }}>{b.total.toLocaleString()}</div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#2c1810' }}>{b.monthlyAvg.toLocaleString()}</div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: b.months5c <= 1 ? '#27ae60' : '#8a8580' }}>{b.months5c}월</div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: b.months10c <= 3 ? '#27ae60' : b.months10c <= 6 ? '#e67e22' : '#c0392b' }}>{b.months10c}월</div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: b.months20c <= 6 ? '#27ae60' : b.months20c <= 12 ? '#e67e22' : '#c0392b' }}>{b.months20c}월</div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: patternColor[b.pattern] || '#8a8580', background: (patternColor[b.pattern] || '#8a8580') + '15' }}>
                      {b.pattern}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
