'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ══════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════

interface InventoryItem {
  item_no: string;
  item_name: string;
  brand?: string;
  importer?: string;
  volume_ml?: string;
  barcode?: string;
  supply_price: number;
  discount_price: number;
  wholesale_price: number;
  retail_price: number;
  min_price: number;
  total_stock?: number;
  stock_excl_available?: number;
  pending_shipment?: number;
  available_stock: number;
  bonded_warehouse?: number;
  anseong_warehouse?: number;
  incoming_stock: number;
  sales_30days: number;
  avg_sales_90d?: number;
  avg_sales_365d?: number;
  yongma_logistics?: number;
  yongma_reserve?: number;
  yongma_marketing?: number;
  yongma_sales1?: number;
  yongma_sales2?: number;
  gig_warehouse?: number;
  gig_marketing?: number;
  gig_sales1?: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

interface QuoteItem {
  id: number;
  item_code: string;
  barcode?: string;
  country: string;
  brand: string;
  region: string;
  image_url: string;
  vintage: string;
  product_name: string;
  english_name: string;
  korean_name: string;
  supply_price: number;
  min_price: number;
  retail_price: number;
  discount_rate: number;
  discounted_price: number;
  quantity: number;
  note: string;
  tasting_note: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type WarehouseTab = 'CDV' | 'DL';

// ══════════════════════════════════════════
// INVENTORY COLUMNS
// ══════════════════════════════════════════

type InvColumnKey =
  | 'item_no' | 'item_name' | 'category' | 'brand' | 'importer' | 'volume_ml' | 'barcode'
  | 'supply_price' | 'discount_price' | 'wholesale_price' | 'retail_price' | 'min_price'
  | 'total_stock' | 'stock_excl_available' | 'pending_shipment' | 'available_stock'
  | 'bonded_warehouse' | 'anseong_warehouse' | 'incoming_stock'
  | 'sales_30days' | 'avg_sales_90d' | 'avg_sales_365d'
  | 'yongma_logistics' | 'yongma_reserve' | 'yongma_marketing' | 'yongma_sales1' | 'yongma_sales2'
  | 'gig_warehouse' | 'gig_marketing' | 'gig_sales1'
  | 'vintage' | 'alcohol_content' | 'country';

// 품번 첫 글자 → 상품 분류
const ITEM_CATEGORY_MAP: Record<string, string> = {
  '0': 'Champagne', '1': 'Sparkling', '2': 'Red', '3': 'White',
  '4': 'Rosé', '5': 'Icewine', '6': 'Grappa', '7': 'Set',
  '8': 'POS Material', '9': '자재', 'A': 'Port', 'D': '대유',
  'E': '자재(대유)', 'Z': '타사제품',
};
function getItemCategory(itemNo: string): string {
  const first = (itemNo || '').charAt(0).toUpperCase();
  return ITEM_CATEGORY_MAP[first] || first || '-';
}

interface InvColumnConfig {
  key: InvColumnKey;
  label: string;
  cdvOnly?: boolean;
  dlOnly?: boolean;
}

const INV_COLUMNS: InvColumnConfig[] = [
  { key: 'item_no', label: '품번' },
  { key: 'item_name', label: '품명' },
  { key: 'category', label: '분류' },
  { key: 'brand', label: '브랜드' },
  { key: 'importer', label: '수입사' },
  { key: 'volume_ml', label: '용량' },
  { key: 'supply_price', label: '공급가' },
  { key: 'discount_price', label: '할인공급가' },
  { key: 'wholesale_price', label: '도매가' },
  { key: 'retail_price', label: '판매가' },
  { key: 'min_price', label: '최저판매가' },
  { key: 'vintage', label: '빈티지' },
  { key: 'alcohol_content', label: '알콜도수' },
  { key: 'country', label: '국가' },
  { key: 'barcode', label: '바코드' },
  { key: 'stock_excl_available', label: '가용재고제외' },
  { key: 'pending_shipment', label: '출고예정' },
  { key: 'total_stock', label: '재고수량' },
  { key: 'available_stock', label: '가용재고' },
  { key: 'bonded_warehouse', label: '보세창고', cdvOnly: true },
  { key: 'yongma_logistics', label: '용마로지스', cdvOnly: true },
  { key: 'yongma_reserve', label: '용마블락', cdvOnly: true },
  { key: 'yongma_marketing', label: '마케팅블락', cdvOnly: true },
  { key: 'yongma_sales1', label: '1부블락', cdvOnly: true },
  { key: 'yongma_sales2', label: '2부블락', cdvOnly: true },
  { key: 'anseong_warehouse', label: '안성창고', dlOnly: true },
  { key: 'gig_warehouse', label: 'GIG', dlOnly: true },
  { key: 'gig_marketing', label: 'GIG마케팅', dlOnly: true },
  { key: 'gig_sales1', label: 'GIG영업1', dlOnly: true },
  { key: 'incoming_stock', label: '미착품' },
  { key: 'sales_30days', label: '30일출고' },
  { key: 'avg_sales_90d', label: '90일평균출고' },
  { key: 'avg_sales_365d', label: '365일평균출고' },
];

const DEFAULT_INV_CDV: InvColumnKey[] = ['item_no', 'item_name', 'supply_price', 'min_price', 'total_stock', 'bonded_warehouse', 'sales_30days'];
const DEFAULT_INV_DL: InvColumnKey[] = ['item_no', 'item_name', 'supply_price', 'min_price', 'total_stock', 'anseong_warehouse', 'sales_30days'];

// ══════════════════════════════════════════
// QUOTE COLUMNS
// ══════════════════════════════════════════

type QuoteColumnKey =
  | 'item_code' | 'category' | 'barcode' | 'country' | 'brand' | 'region' | 'image_url'
  | 'vintage' | 'product_name' | 'english_name' | 'korean_name'
  | 'supply_price' | 'min_price' | 'retail_price' | 'discount_rate'
  | 'discounted_price' | 'retail_discounted_price' | 'quantity' | 'normal_total' | 'discount_total'
  | 'min_price_total' | 'retail_normal_total' | 'retail_discount_total'
  | 'note' | 'tasting_note' | 'grape_varieties';

interface QuoteColumnConfig {
  key: QuoteColumnKey;
  label: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'percent' | 'currency' | 'computed';
}

const QUOTE_COLUMNS: QuoteColumnConfig[] = [
  { key: 'item_code', label: '품목코드' },
  { key: 'category', label: '분류' },
  { key: 'barcode', label: '바코드' },
  { key: 'country', label: '국가' },
  { key: 'brand', label: '브랜드' },
  { key: 'region', label: '지역' },
  { key: 'grape_varieties', label: '포도품종', type: 'text' },
  { key: 'image_url', label: '이미지' },
  { key: 'vintage', label: '빈티지' },
  { key: 'product_name', label: '상품명' },
  { key: 'english_name', label: '영문명' },
  { key: 'korean_name', label: '한글명' },
  { key: 'supply_price', label: '공급가', type: 'currency' },
  { key: 'min_price', label: '최저판매가', type: 'currency' },
  { key: 'retail_price', label: '판매가', type: 'currency' },
  { key: 'discount_rate', label: '할인율', editable: true, type: 'percent' },
  { key: 'discounted_price', label: '할인가', editable: true, type: 'computed' },
  { key: 'retail_discounted_price', label: '할인판매가', editable: true, type: 'computed' },
  { key: 'quantity', label: '수량', editable: true, type: 'number' },
  { key: 'normal_total', label: '정상공급가합계', type: 'computed' },
  { key: 'discount_total', label: '할인공급가합계', type: 'computed' },
  { key: 'min_price_total', label: '최저판매가합계', type: 'computed' },
  { key: 'retail_normal_total', label: '정상판매가합계', type: 'computed' },
  { key: 'retail_discount_total', label: '할인판매가합계', type: 'computed' },
  { key: 'tasting_note', label: '테이스팅노트', type: 'text' },
  { key: 'note', label: '비고', editable: true, type: 'text' },
];

const DEFAULT_QUOTE_VISIBLE: QuoteColumnKey[] = [
  'item_code', 'product_name', 'supply_price', 'discount_rate',
  'discounted_price', 'quantity', 'normal_total', 'discount_total', 'note',
];

// ══════════════════════════════════════════
// DOC SETTINGS
// ══════════════════════════════════════════

interface DocSettings {
  companyName: string;
  address: string;
  addressEn: string;
  websiteUrl: string;
  sender: string;
  title: string;
  content1: string;
  content2: string;
  content3: string;
  unit: string;
  representative: string;
  sealText: string;
}

const CDV_DOC_DEFAULTS: DocSettings = {
  companyName: '(주) 까 브 드 뱅',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444',
  addressEn: 'Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA',
  websiteUrl: 'www.cavedevin.com',
  sender: '(주)까브드뱅',
  title: '와인 제안의 건',
  content1: '1. 귀사의 일익 번창하심을 기원합니다.',
  content2: '2. 아래와 같이 와인 견적을 보내드리오니 검토하여 주시기 바랍니다.',
  content3: '- 아         래 -',
  unit: '단위 : VAT별도, WON, BTL.',
  representative: '대표이사 유병우',
  sealText: '-직인생략-',
};

const DL_DOC_DEFAULTS: DocSettings = {
  companyName: '대유라이프 주식회사',
  address: '서울특별시 영등포구 여의나루로 71, 809호 / TEL: 02-780-9441 / FAX: 02-780-9444',
  addressEn: 'Donghwa Bldg., SUITE 809, 71 Yeouinaru-RO, Yeongdeungpo-GU, SEOUL, 07327, KOREA',
  websiteUrl: 'https://www.instagram.com/riedelpartner_korea/',
  sender: '대유라이프 주식회사',
  title: '리델글라스 견적의 건',
  content1: '1. 귀사의 일익 번창하심을 기원합니다.',
  content2: '2. 아래와 같이 리델글라스 견적을 보내드리오니 검토하여 주시기 바랍니다.',
  content3: '- 아         래 -',
  unit: '단위 : 원, ea, %, VAT별도',
  representative: '대표이사  유 병 우',
  sealText: '-직인 생략-',
};

const TASTING_NOTE_BASE_URL = 'https://github.com/chanbap24-create/order_ai/releases/download/note';

// ══════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════

function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

function formatPrice(price: number | null | undefined): string {
  if (price == null || isNaN(price)) return '-';
  return price > 0 ? `₩${formatNumber(price)}` : '-';
}

function formatWon(n: number): string {
  if (!n && n !== 0) return '';
  return n.toLocaleString('ko-KR');
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function calcDiscountedPrice(price: number, rate: number, storedPrice?: number): number {
  if (storedPrice && storedPrice > 0) return storedPrice;
  return Math.round(price * (1 - rate));
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export default function InventoryPage() {
  // ── Inventory state ──
  const [activeTab, setActiveTab] = useState<WarehouseTab>('CDV');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [hideNoSupplyPrice, setHideNoSupplyPrice] = useState(true);
  const [hideNoStock, setHideNoStock] = useState(true);
  const [showOnlyBondedStock, setShowOnlyBondedStock] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    stock: { enabled: false, min: '', max: '' },
    sales30: { enabled: false, min: '', max: '' },
    sales90: { enabled: false, min: '', max: '' },
    vintage: { enabled: false, min: '', max: '' },
    supplyPrice: { enabled: false, min: '', max: '' },
    retailPrice: { enabled: false, min: '', max: '' },
    minPrice: { enabled: false, min: '', max: '' },
    category: { enabled: false, value: '' },
    country: { enabled: false, value: '' },
  });
  const [countryList, setCountryList] = useState<string[]>([]);
  const [showInvColumnSettings, setShowInvColumnSettings] = useState(false);
  const [visibleColumnsCDV, setVisibleColumnsCDV] = useState<InvColumnKey[]>(DEFAULT_INV_CDV);
  const [visibleColumnsDL, setVisibleColumnsDL] = useState<InvColumnKey[]>(DEFAULT_INV_DL);
  const [searchFocused, setSearchFocused] = useState(false);
  const [clientNameFocused, setClientNameFocused] = useState(false);

  // ── Tasting note modal ──
  const [showTastingNote, setShowTastingNote] = useState(false);
  const [tastingNoteUrl, setTastingNoteUrl] = useState('');
  const [originalPdfUrl, setOriginalPdfUrl] = useState('');
  const [tastingNoteLoading, setTastingNoteLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedWineName, setSelectedWineName] = useState('');
  const [tastingNoteSource, setTastingNoteSource] = useState<'pdf' | 'db' | ''>('');
  const [dbTastingNote, setDbTastingNote] = useState<any>(null);
  const [dbWineInfo, setDbWineInfo] = useState<any>(null);
  const [tastingNotesAvailable, setTastingNotesAvailable] = useState<Record<string, boolean>>({});

  // ── Import schedule state ──
  const [importScheduleMap, setImportScheduleMap] = useState<Record<string, { arrival_date: string; item_name_en: string; item_name_kr: string; brand_code: string; vintage: string; total_btls: number; bl_number: string }[]>>({});
  const [showImportPopup, setShowImportPopup] = useState<string | null>(null);

  // ── Auth state (세션 기반 견적서 분리) ──
  const [quoteManager, setQuoteManager] = useState('');

  // ── Quote state ──
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [docSettings, setDocSettings] = useState<DocSettings>(CDV_DOC_DEFAULTS);
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [visibleQuoteColumns, setVisibleQuoteColumns] = useState<QuoteColumnKey[]>(DEFAULT_QUOTE_VISIBLE);
  const [showQuoteColumnSettings, setShowQuoteColumnSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tastingNoteSet, setTastingNoteSet] = useState<Set<string>>(new Set());
  const [wineProfiles, setWineProfiles] = useState<Record<string, { grape_varieties: string; description_kr: string }>>({});

  // ── Layout state ──
  const [quoteOpen, setQuoteOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showQuotePanel, setShowQuotePanel] = useState(false);
  const [bottomSheetItem, setBottomSheetItem] = useState<QuoteItem | null>(null);
  const [sheetValues, setSheetValues] = useState<Record<string, any>>({});

  // ── Refs ──
  const addedFeedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addedItemNo, setAddedItemNo] = useState<string | null>(null);

  // ══════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════

  // 세션 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.manager) {
          setQuoteManager(data.manager);
        } else {
          setQuoteManager('__loaded__');
        }
      } catch {
        setQuoteManager('__loaded__');
      }
    })();
  }, []);

  // 국가 목록 로드
  useEffect(() => {
    fetch(`/api/inventory/countries?tab=${activeTab}`)
      .then(r => r.json())
      .then(d => setCountryList(d.countries || []))
      .catch(() => {});
  }, [activeTab]);

  // quoteManager 확정 후 견적 로드
  useEffect(() => {
    if (!quoteManager) return;
    const mgr = quoteManager === '__loaded__' ? '' : quoteManager;
    (async () => {
      try {
        const res = await fetch(`/api/quote${mgr ? `?manager=${encodeURIComponent(mgr)}` : ''}`);
        const data = await res.json();
        if (data.success) {
          const items = data.items || [];
          setQuoteItems(items);
          const codes = items.map((i: QuoteItem) => i.item_code).filter(Boolean);
          if (codes.length > 0) {
            fetch(`/api/wine-profiles?item_codes=${encodeURIComponent(JSON.stringify(codes))}`)
              .then(r => r.json())
              .then(wpData => {
                if (wpData.success && wpData.profiles) {
                  const map: Record<string, { grape_varieties: string; description_kr: string }> = {};
                  for (const p of wpData.profiles) {
                    map[p.item_code] = { grape_varieties: p.grape_varieties || '', description_kr: p.description_kr || '' };
                  }
                  setWineProfiles(map);
                }
              })
              .catch(() => {});
          }
        }
      } catch (e) {
        console.error('Failed to fetch quote items:', e);
      } finally {
        setQuoteLoading(false);
      }
    })();
  }, [quoteManager]);

  // ── Import schedule fetch ──
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/admin/upload-data/import-schedule?start_date=${today}`);
        const data = await res.json();
        if (data.success && data.items) {
          const map: Record<string, { arrival_date: string; item_name_en: string; item_name_kr: string; brand_code: string; vintage: string; total_btls: number; bl_number: string }[]> = {};
          for (const item of data.items) {
            const code = item.item_code;
            if (!map[code]) map[code] = [];
            map[code].push({ arrival_date: item.arrival_date, item_name_en: item.item_name_en, item_name_kr: item.item_name_kr || '', brand_code: item.brand_code || '', vintage: item.vintage || '', total_btls: item.total_btls, bl_number: item.bl_number });
          }
          setImportScheduleMap(map);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    fetchTastingNoteIndex();

    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);

    try {
      // Inventory columns
      const dedupe = (cols: InvColumnKey[]): InvColumnKey[] => [...new Set(cols)];
      const savedCDV = localStorage.getItem('inventory_columns_cdv');
      const savedDL = localStorage.getItem('inventory_columns_dl');
      if (savedCDV) try { setVisibleColumnsCDV(dedupe(JSON.parse(savedCDV))); } catch {}
      if (savedDL) try { setVisibleColumnsDL(dedupe(JSON.parse(savedDL))); } catch {}

      // Company / doc settings (load first to determine tab)
      const savedCompany = localStorage.getItem('quote_company') as WarehouseTab | null;
      const tab = (savedCompany === 'CDV' || savedCompany === 'DL') ? savedCompany : 'CDV';
      if (savedCompany === 'CDV' || savedCompany === 'DL') {
        setActiveTab(savedCompany);
        const savedDoc = localStorage.getItem(`quote_doc_settings_${savedCompany}`);
        if (savedDoc) try { setDocSettings(JSON.parse(savedDoc)); } catch {}
      }

      // Quote columns (per tab)
      const savedQCols = localStorage.getItem(`quote_visible_columns_${tab}`);
      if (savedQCols) try { setVisibleQuoteColumns(JSON.parse(savedQCols)); } catch {}
    } catch {}

    // sessionStorage에서 검색 상태 복원
    try {
      const saved = sessionStorage.getItem('inv_search_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.searchQuery) setSearchQuery(s.searchQuery);
        if (s.activeTab === 'CDV' || s.activeTab === 'DL') setActiveTab(s.activeTab);
        if (typeof s.hideNoSupplyPrice === 'boolean') setHideNoSupplyPrice(s.hideNoSupplyPrice);
        if (typeof s.hideNoStock === 'boolean') setHideNoStock(s.hideNoStock);
        if (typeof s.showOnlyBondedStock === 'boolean') setShowOnlyBondedStock(s.showOnlyBondedStock);
        if (s.advancedFilters) setAdvancedFilters(prev => ({ ...prev, ...s.advancedFilters }));
        if (s.results && s.results.length > 0) {
          setResults(s.results);
          setHasSearched(true);
        }
      }
    } catch {}

    return () => mq.removeEventListener('change', handler);
  }, []);

  // sessionStorage에 검색 상태 저장
  const saveSearchState = useCallback(() => {
    try {
      sessionStorage.setItem('inv_search_state', JSON.stringify({
        searchQuery,
        activeTab,
        hideNoSupplyPrice,
        hideNoStock,
        showOnlyBondedStock,
        advancedFilters,
        results,
      }));
    } catch {}
  }, [searchQuery, activeTab, hideNoSupplyPrice, hideNoStock, showOnlyBondedStock, advancedFilters, results]);

  useEffect(() => {
    saveSearchState();
  }, [saveSearchState]);

  // Save inventory columns
  useEffect(() => {
    try { localStorage.setItem('inventory_columns_cdv', JSON.stringify([...new Set(visibleColumnsCDV)])); } catch {}
  }, [visibleColumnsCDV]);
  useEffect(() => {
    try { localStorage.setItem('inventory_columns_dl', JSON.stringify([...new Set(visibleColumnsDL)])); } catch {}
  }, [visibleColumnsDL]);

  // Save quote columns (per tab)
  useEffect(() => {
    try { localStorage.setItem(`quote_visible_columns_${activeTab}`, JSON.stringify(visibleQuoteColumns)); } catch {}
  }, [visibleQuoteColumns, activeTab]);

  // Save company + doc settings
  useEffect(() => {
    try {
      localStorage.setItem('quote_company', activeTab);
      localStorage.setItem(`quote_doc_settings_${activeTab}`, JSON.stringify(docSettings));
    } catch {}
  }, [activeTab, docSettings]);

  // Body scroll lock when mobile panel open
  useEffect(() => {
    if (showQuotePanel || bottomSheetItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showQuotePanel, bottomSheetItem]);

  // ══════════════════════════════════════
  // API CALLS
  // ══════════════════════════════════════

  async function fetchTastingNoteIndex() {
    try {
      const r = await fetch('/api/tasting-notes');
      const data = await r.json();
      if (data.success && data.notes) {
        const s = new Set<string>();
        for (const [k, v] of Object.entries(data.notes as Record<string, any>)) {
          if ((v as any)?.exists) s.add(k);
        }
        setTastingNoteSet(s);
      }
    } catch {}
  }

  function getManagerParam() {
    if (!quoteManager || quoteManager === '__loaded__') return '';
    return quoteManager;
  }

  async function fetchQuoteItems() {
    try {
      const mgr = getManagerParam();
      const res = await fetch(`/api/quote${mgr ? `?manager=${encodeURIComponent(mgr)}` : ''}`);
      const data = await res.json();
      if (data.success) {
        const items = data.items || [];
        setQuoteItems(items);
        const codes = items.map((i: QuoteItem) => i.item_code).filter(Boolean);
        if (codes.length > 0) {
          fetch(`/api/wine-profiles?item_codes=${encodeURIComponent(JSON.stringify(codes))}`)
            .then(r => r.json())
            .then(wpData => {
              if (wpData.success && wpData.profiles) {
                const map: Record<string, { grape_varieties: string; description_kr: string }> = {};
                for (const p of wpData.profiles) {
                  map[p.item_code] = { grape_varieties: p.grape_varieties || '', description_kr: p.description_kr || '' };
                }
                setWineProfiles(map);
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.error('Failed to fetch quote items:', e);
    } finally {
      setQuoteLoading(false);
    }
  }

  // ── Inventory search ──
  const handleSearch = async () => {
    const hasFilters = Object.values(advancedFilters).some(f => f.enabled);
    if (!searchQuery.trim() && !hasFilters) { setError('검색어 또는 필터 조건을 설정해주세요.'); return; }
    setIsSearching(true);
    setError('');
    setHasSearched(true);
    try {
      let endpoint: string;

      if (hasFilters) {
        // Use filter API (handles both filter-only and filter+text)
        const params = new URLSearchParams();
        params.set('tab', activeTab);
        if (searchQuery.trim()) params.set('q', searchQuery);
        const f = advancedFilters;
        if (f.stock.enabled) { if (f.stock.min !== '') params.set('stockMin', f.stock.min); if (f.stock.max !== '') params.set('stockMax', f.stock.max); }
        if (f.sales30.enabled) { if (f.sales30.min !== '') params.set('sales30Min', f.sales30.min); if (f.sales30.max !== '') params.set('sales30Max', f.sales30.max); }
        if (f.sales90.enabled) { if (f.sales90.min !== '') params.set('sales90Min', f.sales90.min); if (f.sales90.max !== '') params.set('sales90Max', f.sales90.max); }
        if (f.vintage.enabled) { if (f.vintage.min !== '') params.set('vintageMin', f.vintage.min); if (f.vintage.max !== '') params.set('vintageMax', f.vintage.max); }
        if (f.supplyPrice.enabled) { if (f.supplyPrice.min !== '') params.set('supplyPriceMin', f.supplyPrice.min); if (f.supplyPrice.max !== '') params.set('supplyPriceMax', f.supplyPrice.max); }
        if (f.retailPrice.enabled) { if (f.retailPrice.min !== '') params.set('retailPriceMin', f.retailPrice.min); if (f.retailPrice.max !== '') params.set('retailPriceMax', f.retailPrice.max); }
        if (f.minPrice.enabled) { if (f.minPrice.min !== '') params.set('minPriceMin', f.minPrice.min); if (f.minPrice.max !== '') params.set('minPriceMax', f.minPrice.max); }
        if (f.country.enabled && f.country.value) params.set('country', f.country.value);
        endpoint = `/api/inventory/filter?${params.toString()}`;
      } else {
        endpoint = activeTab === 'CDV'
          ? `/api/inventory/search?q=${encodeURIComponent(searchQuery)}`
          : `/api/inventory/dl/search?q=${encodeURIComponent(searchQuery)}`;
      }
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '검색 중 오류가 발생했습니다.');
      const items = data.results || [];

      // 수입일정에만 있는 품목도 검색 결과에 추가 (CDV만)
      if (activeTab === 'CDV') {
        const existingCodes = new Set(items.map((i: InventoryItem) => i.item_no));
        const q = searchQuery.toLowerCase();
        for (const [code, schedules] of Object.entries(importScheduleMap)) {
          if (existingCodes.has(code)) continue;
          const s = schedules[0];
          const matchCode = code.toLowerCase().includes(q);
          const matchBrand = s.brand_code.toLowerCase() === q;
          const matchName = q.length >= 3 && (s.item_name_kr.toLowerCase().includes(q) || s.item_name_en.toLowerCase().includes(q));
          if (matchCode || matchBrand || matchName) {
            items.push({
              item_no: code,
              item_name: s.item_name_kr || s.item_name_en,
              brand: s.brand_code,
              vintage: s.vintage,
              supply_price: 0, discount_price: 0, wholesale_price: 0, retail_price: 0, min_price: 0,
              available_stock: 0, incoming_stock: 0, sales_30days: 0,
              total_stock: 0,
              _isImportOnly: true,
            } as InventoryItem & { _isImportOnly?: boolean });
          }
        }
      }

      setResults(items);
      if (activeTab === 'CDV') {
        items.forEach((item: InventoryItem) => {
          fetch(`/api/tasting-notes?item_no=${item.item_no}`)
            .then(res => res.json())
            .then(d => { if (d.success) setTastingNotesAvailable(prev => ({ ...prev, [item.item_no]: true })); })
            .catch(() => {});
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Quote CRUD ──
  async function addToQuote(inv: InventoryItem) {
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_code: inv.item_no,
          product_name: inv.item_name,
          supply_price: inv.supply_price,
          min_price: inv.min_price || 0,
          retail_price: inv.retail_price || 0,
          country: inv.country || '',
          vintage: inv.vintage || '',
          quantity: 1,
          discount_rate: 0,
          manager: getManagerParam(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchQuoteItems();
        if (!isMobile) setQuoteOpen(true);
        if (isMobile) setShowQuotePanel(true);
        // Visual feedback
        setAddedItemNo(inv.item_no);
        if (addedFeedbackRef.current) clearTimeout(addedFeedbackRef.current);
        addedFeedbackRef.current = setTimeout(() => setAddedItemNo(null), 1200);
      }
    } catch (e) {
      console.error('Failed to add item:', e);
    }
  }

  async function deleteQuoteItem(id: number) {
    try {
      await fetch(`/api/quote?id=${id}`, { method: 'DELETE' });
      setQuoteItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }

  async function updateQuoteItem(id: number, fields: Record<string, any>) {
    try {
      const res = await fetch('/api/quote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setQuoteItems(prev => prev.map(i => (i.id === id ? data.item : i)));
      }
    } catch (e) {
      console.error('Failed to update:', e);
    }
  }

  async function moveItem(idx: number, direction: 'up' | 'down') {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= quoteItems.length) return;
    const newItems = [...quoteItems];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    // Reassign sort_order based on new position
    const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
    setQuoteItems(reordered);
    // Persist to DB
    try {
      await fetch('/api/quote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          items: reordered.map(item => ({ id: item.id, sort_order: item.sort_order })),
        }),
      });
    } catch (e) {
      console.error('Failed to reorder:', e);
    }
  }

  async function clearAllQuote() {
    if (!confirm('견적서의 모든 항목을 삭제하시겠습니까?')) return;
    for (const item of quoteItems) {
      await fetch(`/api/quote?id=${item.id}`, { method: 'DELETE' });
    }
    setQuoteItems([]);
  }

  // ── Tab switch ──
  function switchTab(tab: WarehouseTab) {
    setActiveTab(tab);
    setResults([]);
    setHasSearched(false);
    setSearchQuery('');
    try {
      const saved = localStorage.getItem(`quote_doc_settings_${tab}`);
      if (saved) { setDocSettings(JSON.parse(saved)); }
      else { setDocSettings(tab === 'CDV' ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS); }
    } catch {
      setDocSettings(tab === 'CDV' ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS);
    }
    // Load quote columns for this tab
    try {
      const savedQCols = localStorage.getItem(`quote_visible_columns_${tab}`);
      if (savedQCols) { setVisibleQuoteColumns(JSON.parse(savedQCols)); }
      else { setVisibleQuoteColumns(DEFAULT_QUOTE_VISIBLE); }
    } catch {
      setVisibleQuoteColumns(DEFAULT_QUOTE_VISIBLE);
    }
  }

  // ── Tasting note modal ──
  const handleTastingNoteClick = async (itemNo: string, itemName: string) => {
    setSelectedItemNo(itemNo);
    setSelectedWineName(itemName);
    setTastingNoteLoading(true);
    setShowTastingNote(true);
    setTastingNoteSource('');
    setDbTastingNote(null);
    setDbWineInfo(null);
    setTastingNoteUrl('');
    setOriginalPdfUrl('');
    try {
      const response = await fetch(`/api/tasting-notes?item_no=${itemNo}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        if (data.source === 'db') {
          setTastingNoteSource('db');
          setDbTastingNote(data.tasting_note);
          setDbWineInfo(data.wine_info || null);
          // DB 소스여도 PDF URL이 있으면 다운로드용으로 저장
          if (data.pdf_url) {
            setOriginalPdfUrl(data.pdf_url);
          }
        } else {
          setTastingNoteSource('pdf');
          setTastingNoteUrl(`/api/proxy/pdf?url=${encodeURIComponent(data.pdf_url)}`);
          setOriginalPdfUrl(data.pdf_url);
        }
      } else {
        alert(data.error || '테이스팅 노트를 찾을 수 없습니다.');
        setShowTastingNote(false);
      }
    } catch {
      alert('테이스팅 노트를 불러오는 중 오류가 발생했습니다.');
      setShowTastingNote(false);
    } finally {
      setTastingNoteLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const downloadUrl = `/api/proxy/pdf?url=${encodeURIComponent(url)}&download=true`;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  // ── Inventory column toggle ──
  const toggleInvColumn = (key: InvColumnKey) => {
    if (key === 'item_no' || key === 'item_name') return;
    const current = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
    const setter = activeTab === 'CDV' ? setVisibleColumnsCDV : setVisibleColumnsDL;
    const dedupedCurrent = [...new Set(current)];
    const newCols = dedupedCurrent.includes(key) ? dedupedCurrent.filter(k => k !== key) : [...dedupedCurrent, key];
    setter(newCols);
  };

  // ── Quote inline editing ──
  function startEdit(id: number, key: string, currentValue: any) {
    setEditCell({ id, key });
    if (key === 'discount_rate') {
      setEditValue(String(Math.round((currentValue || 0) * 100)));
    } else if (key === 'discounted_price' || key === 'retail_discounted_price') {
      setEditValue(String(Math.round(Number(currentValue) || 0)));
    } else {
      setEditValue(String(currentValue ?? ''));
    }
  }

  async function commitEdit() {
    if (!editCell) return;
    const { id, key } = editCell;
    let value: any = editValue;
    if (key === 'quantity') {
      value = Math.max(0, parseInt(value) || 0);
    } else if (key === 'discount_rate') {
      const rateVal = Math.min(100, Math.max(0, parseInt(value) || 0)) / 100;
      const item = quoteItems.find(i => i.id === id);
      const dp = item ? Math.round(item.supply_price * (1 - rateVal)) : 0;
      await updateQuoteItem(id, { discount_rate: rateVal, discounted_price: dp });
      setEditCell(null);
      setEditValue('');
      return;
    } else if (key === 'supply_price') {
      value = Math.max(0, parseInt(value) || 0);
    } else if (key === 'discounted_price') {
      const item = quoteItems.find(i => i.id === id);
      if (item && item.supply_price > 0) {
        const newPrice = Math.max(0, parseInt(value) || 0);
        const newRate = (item.supply_price - newPrice) / item.supply_price;
        await updateQuoteItem(id, { discount_rate: Math.round(newRate * 10000) / 10000, discounted_price: newPrice });
        setEditCell(null);
        setEditValue('');
        return;
      }
    } else if (key === 'retail_discounted_price') {
      const item = quoteItems.find(i => i.id === id);
      if (item && (item.retail_price || 0) > 0) {
        const newPrice = Math.max(0, parseInt(value) || 0);
        const newRate = ((item.retail_price || 0) - newPrice) / (item.retail_price || 1);
        await updateQuoteItem(id, { discount_rate: Math.round(newRate * 10000) / 10000, discounted_price: newPrice });
        setEditCell(null);
        setEditValue('');
        return;
      }
    }
    await updateQuoteItem(id, { [key]: value });
    setEditCell(null);
    setEditValue('');
  }

  // ── Mobile bottom sheet ──
  function openBottomSheet(item: QuoteItem) {
    setBottomSheetItem(item);
    setSheetValues({
      quantity: item.quantity,
      discount_rate: Math.round(item.discount_rate * 100),
      discounted_price: String(calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price)),
      note: item.note || '',
      tasting_note: item.tasting_note || '',
    });
  }

  async function saveBottomSheet() {
    if (!bottomSheetItem) return;
    // 할인가를 직접 저장 (정밀도 손실 방지)
    const dp = parseInt(sheetValues.discounted_price) || 0;
    const rate = bottomSheetItem.supply_price > 0
      ? (bottomSheetItem.supply_price - dp) / bottomSheetItem.supply_price
      : 0;
    await updateQuoteItem(bottomSheetItem.id, {
      quantity: Math.max(0, parseInt(sheetValues.quantity) || 0),
      discount_rate: Math.round(rate * 10000) / 10000,
      discounted_price: dp,
      note: sheetValues.note || '',
      tasting_note: sheetValues.tasting_note || '',
    });
    setBottomSheetItem(null);
  }

  // ── Excel export ──
  async function handleExport() {
    // 편집 중인 셀이 있으면 먼저 저장 완료 후 export
    if (editCell) {
      await commitEdit();
    }
    setExporting(true);
    try {
      const columnsParam = encodeURIComponent(JSON.stringify(visibleQuoteColumns));
      const settingsParam = encodeURIComponent(JSON.stringify(docSettings));
      const mgr = getManagerParam();
      const res = await fetch(`/api/quote/export?client_name=${encodeURIComponent(clientName)}&columns=${columnsParam}&doc_settings=${settingsParam}&company=${activeTab}${mgr ? `&manager=${encodeURIComponent(mgr)}` : ''}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.download = `견적서_${dateStr}_${clientName || '미지정'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('엑셀 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  }

  // ══════════════════════════════════════
  // COMPUTED VALUES
  // ══════════════════════════════════════

  // Inventory columns
  const invColumnOrder = INV_COLUMNS.map(c => c.key);
  const rawInvVisible = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
  const visibleInvColumns = [...new Set(rawInvVisible)].sort((a, b) => invColumnOrder.indexOf(a) - invColumnOrder.indexOf(b));

  const availableInvColumns = INV_COLUMNS.filter(col => {
    if (activeTab === 'CDV') return !col.dlOnly;
    if (activeTab === 'DL') return !col.cdvOnly;
    return true;
  });

  // Active advanced filter count
  const activeFilterCount = Object.values(advancedFilters).filter(f => f.enabled).length;

  // Filter results
  const filteredResults = results.filter(item => {
    if (hideNoSupplyPrice && (!item.supply_price || item.supply_price <= 0) && !importScheduleMap[item.item_no]) return false;
    if (activeTab === 'CDV' && showOnlyBondedStock) {
      const hasNoStock = !item.total_stock || item.total_stock <= 0;
      const hasBondedStock = item.bonded_warehouse && item.bonded_warehouse > 0;
      return hasNoStock && hasBondedStock;
    }
    if (hideNoStock && (!item.total_stock || item.total_stock <= 0) && !importScheduleMap[item.item_no]) return false;

    // Advanced filters (range)
    if (advancedFilters.stock.enabled) {
      const v = (item.available_stock || 0) + (item.bonded_warehouse || 0);
      const lo = advancedFilters.stock.min !== '' ? Number(advancedFilters.stock.min) : null;
      const hi = advancedFilters.stock.max !== '' ? Number(advancedFilters.stock.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.sales30.enabled) {
      const v = item.sales_30days || 0;
      const lo = advancedFilters.sales30.min !== '' ? Number(advancedFilters.sales30.min) : null;
      const hi = advancedFilters.sales30.max !== '' ? Number(advancedFilters.sales30.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.sales90.enabled) {
      const v = item.avg_sales_90d || 0;
      const lo = advancedFilters.sales90.min !== '' ? Number(advancedFilters.sales90.min) : null;
      const hi = advancedFilters.sales90.max !== '' ? Number(advancedFilters.sales90.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.vintage.enabled) {
      const v = parseInt(item.vintage);
      if (!isNaN(v)) {
        const lo = advancedFilters.vintage.min !== '' ? Number(advancedFilters.vintage.min) : null;
        const hi = advancedFilters.vintage.max !== '' ? Number(advancedFilters.vintage.max) : null;
        if (lo !== null && v < lo) return false;
        if (hi !== null && v > hi) return false;
      }
    }
    if (advancedFilters.supplyPrice.enabled) {
      const v = item.supply_price || 0;
      const lo = advancedFilters.supplyPrice.min !== '' ? Number(advancedFilters.supplyPrice.min) : null;
      const hi = advancedFilters.supplyPrice.max !== '' ? Number(advancedFilters.supplyPrice.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.retailPrice.enabled) {
      const v = item.retail_price || 0;
      const lo = advancedFilters.retailPrice.min !== '' ? Number(advancedFilters.retailPrice.min) : null;
      const hi = advancedFilters.retailPrice.max !== '' ? Number(advancedFilters.retailPrice.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.minPrice.enabled) {
      const v = item.min_price || 0;
      const lo = advancedFilters.minPrice.min !== '' ? Number(advancedFilters.minPrice.min) : null;
      const hi = advancedFilters.minPrice.max !== '' ? Number(advancedFilters.minPrice.max) : null;
      if (lo !== null && v < lo) return false;
      if (hi !== null && v > hi) return false;
    }
    if (advancedFilters.category?.enabled && advancedFilters.category?.value) {
      if (getItemCategory(item.item_no) !== advancedFilters.category.value) return false;
    }
    if (advancedFilters.country.enabled && advancedFilters.country.value) {
      if ((item.country || '') !== advancedFilters.country.value) return false;
    }
    return true;
  });

  // Quote columns
  const visibleQuoteCols = visibleQuoteColumns.map(key => QUOTE_COLUMNS.find(c => c.key === key)).filter(Boolean) as QuoteColumnConfig[];

  // Totals
  const totalNormal = quoteItems.reduce((s, i) => s + i.supply_price * i.quantity, 0);
  const totalDiscount = quoteItems.reduce((s, i) => s + calcDiscountedPrice(i.supply_price, i.discount_rate, i.discounted_price) * i.quantity, 0);
  const totalRetailNormal = quoteItems.reduce((s, i) => s + (i.retail_price || 0) * i.quantity, 0);
  const totalRetailDiscount = quoteItems.reduce((s, i) => s + calcDiscountedPrice(i.retail_price || 0, i.discount_rate) * i.quantity, 0);
  const totalQty = quoteItems.reduce((s, i) => s + i.quantity, 0);

  // ══════════════════════════════════════
  // RENDER HELPERS
  // ══════════════════════════════════════

  const renderInvCellValue = (item: InventoryItem, key: InvColumnKey) => {
    switch (key) {
      case 'item_no': return item.item_no;
      case 'item_name': return item.item_name;
      case 'category': return getItemCategory(item.item_no);
      case 'brand': case 'importer': case 'volume_ml': case 'barcode':
        return item[key] || '-';
      case 'supply_price': case 'discount_price': case 'wholesale_price':
      case 'retail_price': case 'min_price':
        return formatPrice(item[key]);
      case 'total_stock':
        return (
          <span style={{ color: (item.total_stock ?? 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
            {formatNumber(item.total_stock ?? 0)}
          </span>
        );
      case 'available_stock':
        return (
          <span style={{ color: (item.available_stock ?? 0) > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
            {formatNumber(item.available_stock ?? 0)}
          </span>
        );
      case 'stock_excl_available': case 'pending_shipment':
      case 'bonded_warehouse': case 'yongma_logistics': case 'anseong_warehouse':
      case 'gig_warehouse': case 'gig_marketing': case 'gig_sales1':
      case 'incoming_stock': case 'sales_30days': case 'avg_sales_90d': case 'avg_sales_365d':
        return formatNumber(item[key] ?? 0);
      case 'vintage': return item.vintage || '-';
      case 'alcohol_content': return item.alcohol_content || '-';
      case 'country': return item.country || '-';
      default: return '-';
    }
  };

  function getQuoteCellValue(item: QuoteItem, key: QuoteColumnKey): string | number {
    switch (key) {
      case 'discounted_price': return calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price);
      case 'retail_discounted_price': return calcDiscountedPrice(item.retail_price || 0, item.discount_rate);
      case 'normal_total': return item.supply_price * item.quantity;
      case 'discount_total': return calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price) * item.quantity;
      case 'min_price_total': return (item.min_price || 0) * item.quantity;
      case 'retail_normal_total': return (item.retail_price || 0) * item.quantity;
      case 'retail_discount_total': return calcDiscountedPrice(item.retail_price || 0, item.discount_rate) * item.quantity;
      case 'discount_rate': return item.discount_rate;
      case 'category': return getItemCategory(item.item_code);
      case 'grape_varieties': return wineProfiles[item.item_code]?.grape_varieties || '';
      default: return (item as any)[key] ?? '';
    }
  }

  function formatQuoteCellValue(item: QuoteItem, col: QuoteColumnConfig): string {
    const val = getQuoteCellValue(item, col.key);
    if (col.type === 'currency' || col.type === 'computed') return formatWon(Number(val));
    if (col.type === 'percent') return formatPercent(Number(val));
    return String(val);
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: '#fafaf8', wordBreak: 'keep-all' as const }}>
      <style>{`
        .inv-card {
          transition: all 0.2s ease;
          position: relative;
        }
        .inv-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 2px;
          background: #E0D5D0;
          border-radius: 2px 0 0 2px;
          transition: background 0.2s ease;
        }
        .inv-card:hover {
          box-shadow: 0 4px 12px -4px rgba(90,21,21,0.10);
          transform: translateY(-1px);
        }
        .inv-card:hover::before {
          background: #5A1515;
        }
        .inv-chip {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 12px;
          border-radius: 14px;
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid #E5E5E5;
          background: white;
          color: #666;
          user-select: none;
          white-space: nowrap;
        }
        .inv-chip.active {
          background: rgba(90,21,21,0.08);
          border-color: #5A1515;
          color: #5A1515;
        }
        .inv-chip.disabled {
          opacity: 0.4;
          pointer-events: none;
        }
        .inv-col-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid #E5E5E5;
          background: white;
          color: #666;
          user-select: none;
          white-space: nowrap;
        }
        .inv-col-chip.active {
          background: #5A1515;
          border-color: #5A1515;
          color: white;
        }
        .inv-col-chip.locked {
          opacity: 0.4;
          pointer-events: none;
        }
        .add-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #5A1515;
          color: white;
          font-size: 18px;
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          transition: all 0.2s ease;
        }
        .add-btn:hover {
          background: #7a2040;
          transform: scale(1.1);
        }
        .add-btn.added {
          background: #10b981;
        }
        .quote-basket-header {
          transition: background 0.2s ease;
        }
        .quote-basket-header:hover {
          background: #f5f4f2 !important;
        }
        .quote-slide-overlay {
          animation: fadeIn 0.2s ease;
        }
        .quote-slide-panel {
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
        @media (max-width: 480px) {
          .inv-col-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px 24px', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>

        {/* ═══════════════════════════════════ */}
        {/* HEADER                             */}
        {/* ═══════════════════════════════════ */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0 12px',
        }}>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1a1a2e',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '-0.01em',
          }}>
            Inventory & Quote
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* CDV / DL toggle */}
            <div style={{ display: 'flex', background: '#F0EFED', borderRadius: 8, padding: 2 }}>
              {(['CDV', 'DL'] as WarehouseTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: activeTab === tab ? 'white' : 'transparent',
                    color: activeTab === tab ? '#5A1515' : '#999',
                    boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {tab === 'CDV' ? 'Wine' : 'Riedel'}
                </button>
              ))}
            </div>

            {/* Settings gear */}
            <button
              onClick={() => setShowInvColumnSettings(!showInvColumnSettings)}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: showInvColumnSettings ? 'rgba(90,21,21,0.08)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                color: showInvColumnSettings ? '#5A1515' : '#999',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            {/* Excel export */}
            <button
              onClick={handleExport}
              disabled={exporting || quoteItems.length === 0}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: quoteItems.length > 0 && !exporting ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                background: quoteItems.length > 0 ? '#1a1a2e' : '#E5E5E5',
                color: quoteItems.length > 0 ? 'white' : '#999',
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? '...' : 'Excel'}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* DESKTOP: SIDE-BY-SIDE LAYOUT        */}
        {/* ═══════════════════════════════════ */}
        <div style={{
          display: isMobile ? 'block' : 'flex',
          gap: isMobile ? 0 : 24,
          alignItems: 'flex-start',
        }}>

        {/* ── LEFT COLUMN: Search & Results ── */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? 'none' : '50%' }}>

        {/* ═══════════════════════════════════ */}
        {/* INVENTORY COLUMN SETTINGS           */}
        {/* ═══════════════════════════════════ */}
        {showInvColumnSettings && (
          <div style={{
            marginBottom: 12, padding: '14px 16px',
            background: 'white', borderRadius: 12,
            border: '1px solid #F0EFED',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D' }}>표시 컬럼</span>
              <span style={{ fontSize: '0.68rem', color: '#999' }}>품번·품명은 항상 표시</span>
            </div>
            <div className="inv-col-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {availableInvColumns
                .filter(col => col.key !== 'item_no' && col.key !== 'item_name')
                .map(col => (
                  <button
                    key={`${col.key}-${col.label}`}
                    className={`inv-col-chip${visibleInvColumns.includes(col.key) ? ' active' : ''}`}
                    onClick={() => toggleInvColumn(col.key)}
                  >
                    {col.label}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* SEARCH BAR                          */}
        {/* ═══════════════════════════════════ */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={searchFocused ? '#5A1515' : '#BCBCBC'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute', left: 14, top: '50%',
              transform: 'translateY(-50%)', transition: 'stroke 0.2s ease', pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search wine or item code..."
            disabled={isSearching}
            style={{
              width: '100%', height: 48, paddingLeft: 42, paddingRight: 96,
              border: `1.5px solid ${searchFocused ? '#5A1515' : '#E5E5E5'}`,
              borderRadius: 12, fontSize: 16, background: 'white', outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: searchFocused ? '0 0 0 3px rgba(90,21,21,0.06)' : '0 1px 2px rgba(0,0,0,0.04)',
              color: '#1a1a2e', boxSizing: 'border-box',
            }}
          />
          <div style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <button
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              style={{
                position: 'relative',
                width: 34, height: 34, borderRadius: 6, border: 'none',
                background: activeFilterCount > 0 ? 'rgba(90,21,21,0.1)' : showAdvancedFilter ? '#F0EFED' : 'transparent',
                color: activeFilterCount > 0 ? '#5A1515' : '#999',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#5A1515', color: 'white',
                  fontSize: '0.6rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none',
                background: '#F0EFED', color: '#5A1515', fontWeight: 600, fontSize: '0.75rem',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', opacity: isSearching ? 0.6 : 1,
              }}
            >
              {isSearching ? '검색중' : '검색'}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* ADVANCED FILTER PANEL               */}
        {/* ═══════════════════════════════════ */}
        {showAdvancedFilter && (
          <div style={{
            marginBottom: 12, padding: '14px 16px',
            background: 'white', borderRadius: 12,
            border: '1px solid #F0EFED',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D' }}>조건 필터</span>
              {activeFilterCount > 0 && (
                <span style={{ fontSize: '0.68rem', color: '#5A1515', fontWeight: 500 }}>
                  {activeFilterCount}개 활성
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* 재고+보세 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.stock.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, stock: { ...f.stock, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  재고+보세
                </label>
                <input type="number" value={advancedFilters.stock.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, stock: { ...f.stock, min: e.target.value } }))}
                  disabled={!advancedFilters.stock.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.stock.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.stock.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, stock: { ...f.stock, max: e.target.value } }))}
                  disabled={!advancedFilters.stock.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.stock.enabled ? 1 : 0.4 }} />
              </div>

              {/* 30일 출고 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.sales30.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, sales30: { ...f.sales30, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  30일 출고
                </label>
                <input type="number" value={advancedFilters.sales30.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, sales30: { ...f.sales30, min: e.target.value } }))}
                  disabled={!advancedFilters.sales30.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.sales30.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.sales30.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, sales30: { ...f.sales30, max: e.target.value } }))}
                  disabled={!advancedFilters.sales30.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.sales30.enabled ? 1 : 0.4 }} />
              </div>

              {/* 90일 출고 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.sales90.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, sales90: { ...f.sales90, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  90일 출고
                </label>
                <input type="number" value={advancedFilters.sales90.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, sales90: { ...f.sales90, min: e.target.value } }))}
                  disabled={!advancedFilters.sales90.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.sales90.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.sales90.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, sales90: { ...f.sales90, max: e.target.value } }))}
                  disabled={!advancedFilters.sales90.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.sales90.enabled ? 1 : 0.4 }} />
              </div>

              {/* 빈티지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.vintage.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, vintage: { ...f.vintage, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  빈티지
                </label>
                <input type="number" value={advancedFilters.vintage.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, vintage: { ...f.vintage, min: e.target.value } }))}
                  disabled={!advancedFilters.vintage.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.vintage.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.vintage.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, vintage: { ...f.vintage, max: e.target.value } }))}
                  disabled={!advancedFilters.vintage.enabled}
                  style={{ width: 65, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.vintage.enabled ? 1 : 0.4 }} />
              </div>

              {/* 공급가 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.supplyPrice.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, supplyPrice: { ...f.supplyPrice, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  공급가
                </label>
                <input type="number" value={advancedFilters.supplyPrice.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, supplyPrice: { ...f.supplyPrice, min: e.target.value } }))}
                  disabled={!advancedFilters.supplyPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.supplyPrice.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.supplyPrice.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, supplyPrice: { ...f.supplyPrice, max: e.target.value } }))}
                  disabled={!advancedFilters.supplyPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.supplyPrice.enabled ? 1 : 0.4 }} />
              </div>

              {/* 소비자가 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.retailPrice.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, retailPrice: { ...f.retailPrice, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  소비자가
                </label>
                <input type="number" value={advancedFilters.retailPrice.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, retailPrice: { ...f.retailPrice, min: e.target.value } }))}
                  disabled={!advancedFilters.retailPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.retailPrice.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.retailPrice.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, retailPrice: { ...f.retailPrice, max: e.target.value } }))}
                  disabled={!advancedFilters.retailPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.retailPrice.enabled ? 1 : 0.4 }} />
              </div>

              {/* 최저판매가 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.minPrice.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, minPrice: { ...f.minPrice, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  최저판매가
                </label>
                <input type="number" value={advancedFilters.minPrice.min} placeholder="최소"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, minPrice: { ...f.minPrice, min: e.target.value } }))}
                  disabled={!advancedFilters.minPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.minPrice.enabled ? 1 : 0.4 }} />
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>~</span>
                <input type="number" value={advancedFilters.minPrice.max} placeholder="최대"
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, minPrice: { ...f.minPrice, max: e.target.value } }))}
                  disabled={!advancedFilters.minPrice.enabled}
                  style={{ width: 80, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 16, textAlign: 'right', opacity: advancedFilters.minPrice.enabled ? 1 : 0.4 }} />
              </div>

              {/* 분류 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.category?.enabled || false}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, category: { ...(f.category || { enabled: false, value: '' }), enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  분류
                </label>
                <select value={advancedFilters.category?.value || ''}
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, category: { ...(f.category || { enabled: false, value: '' }), value: e.target.value } }))}
                  disabled={!advancedFilters.category?.enabled}
                  style={{ width: 150, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 14, color: '#333', opacity: advancedFilters.category?.enabled ? 1 : 0.4 }}>
                  <option value="">전체</option>
                  {Object.entries(ITEM_CATEGORY_MAP).map(([k, v]) => <option key={k} value={v}>{v}</option>)}
                </select>
              </div>

              {/* 국가 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedFilters.country.enabled}
                    onChange={(e) => setAdvancedFilters(f => ({ ...f, country: { ...f.country, enabled: e.target.checked } }))}
                    style={{ accentColor: '#5A1515' }} />
                  국가
                </label>
                <select value={advancedFilters.country.value}
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, country: { ...f.country, value: e.target.value } }))}
                  disabled={!advancedFilters.country.enabled}
                  style={{ width: 150, height: 30, borderRadius: 6, border: '1px solid #E5E5E5', padding: '0 6px', fontSize: 14, color: '#333', opacity: advancedFilters.country.enabled ? 1 : 0.4 }}>
                  <option value="">전체</option>
                  {countryList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* 적용 / 초기화 buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAdvancedFilters({
                  stock: { enabled: false, min: '', max: '' },
                  sales30: { enabled: false, min: '', max: '' },
                  sales90: { enabled: false, min: '', max: '' },
                  vintage: { enabled: false, min: '', max: '' },
                  supplyPrice: { enabled: false, min: '', max: '' },
                  retailPrice: { enabled: false, min: '', max: '' },
                  country: { enabled: false, value: '' },
                })}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: '1px solid #E5E5E5',
                  background: 'white', color: '#888', fontSize: '0.75rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
              >
                초기화
              </button>
              <button
                onClick={() => { setShowAdvancedFilter(false); handleSearch(); }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: '#5A1515', color: 'white', fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
              >
                검색
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginBottom: 12, padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: 8, color: '#ef4444', fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* FILTER CHIPS                        */}
        {/* ═══════════════════════════════════ */}
        <div style={{
          marginBottom: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            color: hasSearched ? '#2D2D2D' : '#BCBCBC', minWidth: 60,
          }}>
            {hasSearched ? `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''}` : 'No search'}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`inv-chip${hideNoSupplyPrice ? ' active' : ''}${!hasSearched ? ' disabled' : ''}`}
              onClick={() => setHideNoSupplyPrice(!hideNoSupplyPrice)}
            >
              공급가 ✓
            </button>
            <button
              className={`inv-chip${hideNoStock ? ' active' : ''}${!hasSearched || showOnlyBondedStock ? ' disabled' : ''}`}
              onClick={() => setHideNoStock(!hideNoStock)}
            >
              재고 ✓
            </button>
            {activeTab === 'CDV' && (
              <button
                className={`inv-chip${showOnlyBondedStock ? ' active' : ''}${!hasSearched || hideNoStock ? ' disabled' : ''}`}
                onClick={() => setShowOnlyBondedStock(!showOnlyBondedStock)}
              >
                보세만
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* SEARCH RESULTS                      */}
        {/* ═══════════════════════════════════ */}
        {hasSearched && (
          <div>
            {filteredResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredResults.map((item, index) => (
                  <div key={`${item.item_no}-${index}`} className="inv-card" style={{
                    padding: '12px 14px 12px 16px',
                    background: 'white', borderRadius: 10,
                    border: '1px solid #F0EFED',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    cursor: 'default',
                  }}>
                    {/* Row 1: Item code + name + add button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
                        {activeTab === 'CDV' ? (
                          <button
                            onClick={() => handleTastingNoteClick(item.item_no, item.item_name)}
                            style={{
                              fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600,
                              color: tastingNotesAvailable[item.item_no] ? '#10b981' : '#BCBCBC',
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              textDecoration: tastingNotesAvailable[item.item_no] ? 'underline' : 'none',
                              flexShrink: 0,
                            }}
                          >
                            {item.item_no}
                          </button>
                        ) : (
                          <span style={{
                            fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 600,
                            color: '#BCBCBC', flexShrink: 0,
                          }}>
                            {item.item_no}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.84rem', fontWeight: 700, color: '#1a1a2e',
                          lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.item_name}
                        </span>
                        {(item as any).item_name_en && (
                          <span style={{
                            fontSize: '0.68rem', color: '#999', fontWeight: 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
                          }}>
                            {(item as any).item_name_en}
                          </span>
                        )}
                        {importScheduleMap[item.item_no] && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowImportPopup(showImportPopup === item.item_no ? null : item.item_no); }}
                            style={{
                              background: '#E65100', color: '#fff', border: 'none', borderRadius: 4,
                              fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', cursor: 'pointer',
                              flexShrink: 0, whiteSpace: 'nowrap', lineHeight: 1.2,
                            }}
                          >
                            입항 {importScheduleMap[item.item_no][0].arrival_date.slice(5)}
                          </button>
                        )}
                      </div>
                      {/* [+] Add to quote button */}
                      <button
                        className={`add-btn${addedItemNo === item.item_no ? ' added' : ''}`}
                        onClick={() => addToQuote(item)}
                      >
                        {addedItemNo === item.item_no ? '✓' : '+'}
                      </button>
                    </div>

                    {/* Row 2: Values as inline tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {visibleInvColumns
                        .filter(colKey => colKey !== 'item_no' && colKey !== 'item_name')
                        .map(colKey => {
                          const col = availableInvColumns.find(c => c.key === colKey);
                          if (!col) return null;
                          return (
                            <span key={`${item.item_no}-${colKey}`} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 6, background: '#F7F6F4',
                              fontSize: '0.72rem', lineHeight: 1,
                            }}>
                              <span style={{ color: '#999', fontWeight: 500 }}>{col.label}</span>
                              <span style={{ color: '#2D2D2D', fontWeight: 600 }}>
                                {renderInvCellValue(item, colKey)}
                              </span>
                            </span>
                          );
                        })}
                    </div>

                    {/* 수입일정 팝업 */}
                    {showImportPopup === item.item_no && importScheduleMap[item.item_no] && (
                      <div style={{
                        marginTop: 8, padding: '10px 12px', background: '#FFF3E0',
                        borderRadius: 8, border: '1px solid rgba(230,81,0,0.2)',
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#E65100', marginBottom: 6 }}>
                          수입일정
                        </div>
                        {importScheduleMap[item.item_no].map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: '#4E342E', marginBottom: 3 }}>
                            <span style={{ fontWeight: 600 }}>{s.arrival_date}</span>
                            <span>{s.total_btls.toLocaleString()}btls</span>
                            <span style={{ color: '#8a8580' }}>{s.bl_number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                background: 'white', borderRadius: 12, border: '1px solid #F0EFED',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D0D0D0" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2D2D2D' }}>No results found</div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
                  {results.length === 0 ? 'Try a different search term' : 'Adjust filters to see more items'}
                </div>
              </div>
            )}
          </div>
        )}

        </div>
        {/* ── end LEFT COLUMN ── */}

        {/* ═══════════════════════════════════ */}
        {/* RIGHT COLUMN: Quote Sidebar         */}
        {/* ═══════════════════════════════════ */}
        {!isMobile && (
          <div style={{
            flex: 1, minWidth: 0, maxWidth: '50%',
            position: 'sticky', top: 72, alignSelf: 'flex-start',
          }}>
            <div style={{
              background: 'white', borderRadius: 12,
              border: '1.5px solid #E5E5E5',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              maxHeight: 'calc(100vh - 88px)',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Sidebar header */}
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid #F0EFED',
                display: 'flex', alignItems: 'center', gap: 8,
                position: 'sticky', top: 0, background: 'white',
                borderRadius: '12px 12px 0 0', zIndex: 1,
              }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1a1a2e', fontFamily: "'Cormorant Garamond', serif" }}>Quote</span>
                {quoteItems.length > 0 && (
                  <span style={{
                    background: '#5A1515', color: 'white', borderRadius: 10,
                    padding: '2px 8px', fontSize: 11, fontWeight: 700,
                  }}>
                    {quoteItems.length}
                  </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="거래처명"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    onFocus={() => setClientNameFocused(true)}
                    onBlur={() => setClientNameFocused(false)}
                    style={{
                      width: 120, fontSize: 16, padding: '5px 10px',
                      borderRadius: 8, border: `1.5px solid ${clientNameFocused ? '#5A1515' : '#E5E5E5'}`, outline: 'none',
                      boxShadow: clientNameFocused ? '0 0 0 3px rgba(90,21,21,0.06)' : 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDocSettings(!showDocSettings); }}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5E5',
                      background: showDocSettings ? 'rgba(90,21,21,0.08)' : 'white',
                      cursor: 'pointer', fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="문서 설정"
                  >
                    📄
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQuoteColumnSettings(!showQuoteColumnSettings); }}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5E5',
                      background: showQuoteColumnSettings ? 'rgba(90,21,21,0.08)' : 'white',
                      cursor: 'pointer', fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="컬럼 설정"
                  >
                    ⚙
                  </button>
                  {quoteItems.length > 0 && (
                    <button
                      onClick={clearAllQuote}
                      style={{
                        padding: '3px 8px', borderRadius: 8,
                        border: '1px solid #e74c3c', background: 'white',
                        color: '#e74c3c', fontSize: '0.68rem', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>

              {/* Sidebar body */}
              <div style={{ padding: 16 }}>

                {/* Doc settings panel */}
                {showDocSettings && (
                  <div style={{
                    marginBottom: 12, padding: 14, background: '#fafaf8',
                    borderRadius: 8, border: '1px solid #F0EFED',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, color: '#2D2D2D' }}>문서 설정</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {([
                        ['companyName', '회사명'], ['address', '주소/연락처'], ['addressEn', '영문주소'],
                        ['websiteUrl', '웹사이트/SNS'], ['sender', '발신'], ['title', '제목'],
                        ['content1', '내용 1'], ['content2', '내용 2'], ['content3', '내용 3'],
                        ['unit', '단위'], ['representative', '대표자'], ['sealText', '직인'],
                      ] as [string, string][]).map(([key, label]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#555', minWidth: 72, flexShrink: 0 }}>{label}</label>
                          <input
                            type="text"
                            value={(docSettings as any)[key] || ''}
                            onChange={e => setDocSettings(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              flex: 1, fontSize: 13, padding: '5px 8px', borderRadius: 6,
                              border: '1px solid #E5E5E5', minWidth: 0, outline: 'none',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setDocSettings(activeTab === 'CDV' ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS)}
                      style={{
                        marginTop: 8, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid #E5E5E5', background: 'white',
                        fontSize: '0.72rem', cursor: 'pointer', color: '#666',
                      }}
                    >
                      기본값 초기화
                    </button>
                  </div>
                )}

                {/* Quote column settings */}
                {showQuoteColumnSettings && (
                  <div style={{
                    marginBottom: 12, padding: 14, background: '#fafaf8',
                    borderRadius: 8, border: '1px solid #F0EFED',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: '#2D2D2D' }}>견적 컬럼 (체크 + 순서 변경)</div>
                    {/* 활성 컬럼 순서 변경 */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: 4 }}>표시 순서 (◀▶ 로 이동)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {visibleQuoteColumns.map((key, idx) => {
                          const col = QUOTE_COLUMNS.find(c => c.key === key);
                          if (!col) return null;
                          return (
                            <div key={key} style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              padding: '3px 6px', borderRadius: 6,
                              background: '#fff', border: '1px solid rgba(90,21,21,0.2)',
                              fontSize: 11,
                            }}>
                              <button
                                onClick={() => { if (idx === 0) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a; }); }}
                                disabled={idx === 0}
                                style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: '0 2px', fontSize: 11, color: idx === 0 ? '#ddd' : '#5A1515' }}
                              >◀</button>
                              <span style={{ fontWeight: 600, color: '#2D2D2D' }}>{col.label}</span>
                              <button
                                onClick={() => { if (idx === visibleQuoteColumns.length-1) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; }); }}
                                disabled={idx === visibleQuoteColumns.length - 1}
                                style={{ background: 'none', border: 'none', cursor: idx === visibleQuoteColumns.length-1 ? 'default' : 'pointer', padding: '0 2px', fontSize: 11, color: idx === visibleQuoteColumns.length-1 ? '#ddd' : '#5A1515' }}
                              >▶</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* 컬럼 표시/숨김 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {QUOTE_COLUMNS.map(col => (
                        <label key={col.key} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 12, cursor: 'pointer', padding: '4px 8px',
                          borderRadius: 6,
                          background: visibleQuoteColumns.includes(col.key) ? 'rgba(90,21,21,0.06)' : '#fff',
                          border: `1px solid ${visibleQuoteColumns.includes(col.key) ? 'rgba(90,21,21,0.2)' : '#E5E5E5'}`,
                        }}>
                          <input
                            type="checkbox"
                            checked={visibleQuoteColumns.includes(col.key)}
                            onChange={() => {
                              setVisibleQuoteColumns(prev =>
                                prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key]
                              );
                            }}
                            style={{ width: 14, height: 14 }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}


                {quoteLoading && (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '0.82rem' }}>
                    견적 불러오는 중...
                  </div>
                )}

                {/* Quote table */}
                {quoteItems.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#fafaf8' }}>
                          <th style={{ ...qThStyle, width: 60 }}>순서</th>
                          {visibleQuoteCols.map((col, ci) => (
                            <th key={col.key} style={{
                              ...qThStyle,
                              textAlign: (col.type === 'currency' || col.type === 'computed') ? 'right'
                                : col.type === 'number' || col.type === 'percent' ? 'center' : 'center',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                <button
                                  onClick={() => { if (ci === 0) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[ci-1], a[ci]] = [a[ci], a[ci-1]]; return a; }); }}
                                  style={{ background: 'none', border: 'none', cursor: ci === 0 ? 'default' : 'pointer', padding: 0, fontSize: 9, color: ci === 0 ? '#ddd' : '#999', lineHeight: 1 }}
                                >◀</button>
                                <span>{col.label}</span>
                                <button
                                  onClick={() => { if (ci === visibleQuoteCols.length-1) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[ci], a[ci+1]] = [a[ci+1], a[ci]]; return a; }); }}
                                  style={{ background: 'none', border: 'none', cursor: ci === visibleQuoteCols.length-1 ? 'default' : 'pointer', padding: 0, fontSize: 9, color: ci === visibleQuoteCols.length-1 ? '#ddd' : '#999', lineHeight: 1 }}
                                >▶</button>
                              </div>
                            </th>
                          ))}
                          <th style={{ ...qThStyle, width: 36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteItems.map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ ...qTdStyle, textAlign: 'center', color: '#888', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => moveItem(idx, 'up')}
                                disabled={idx === 0}
                                style={{
                                  background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                                  color: idx === 0 ? '#ddd' : '#666', fontSize: 12, padding: '0 2px', lineHeight: 1,
                                }}
                                title="위로"
                              >▲</button>
                              <span style={{ fontSize: 12, margin: '0 1px' }}>{idx + 1}</span>
                              <button
                                onClick={() => moveItem(idx, 'down')}
                                disabled={idx === quoteItems.length - 1}
                                style={{
                                  background: 'none', border: 'none', cursor: idx === quoteItems.length - 1 ? 'default' : 'pointer',
                                  color: idx === quoteItems.length - 1 ? '#ddd' : '#666', fontSize: 12, padding: '0 2px', lineHeight: 1,
                                }}
                                title="아래로"
                              >▼</button>
                            </td>
                            {visibleQuoteCols.map(col => {
                              const isEditing = editCell?.id === item.id && editCell?.key === col.key;
                              const isEditable = col.editable;
                              const val = getQuoteCellValue(item, col.key);
                              const formatted = formatQuoteCellValue(item, col);
                              const align: 'left' | 'right' | 'center' =
                                (col.type === 'currency' || col.type === 'computed') ? 'right'
                                : col.type === 'number' || col.type === 'percent' ? 'center' : 'left';

                              return (
                                <td
                                  key={col.key}
                                  style={{
                                    ...qTdStyle, textAlign: align,
                                    cursor: isEditable ? 'pointer' : 'default',
                                    background: isEditing ? '#FFF9C4' : 'transparent',
                                    fontWeight: col.key === 'product_name' ? 600 : 400,
                                    color: col.key === 'discount_total' ? '#5A1515' : '#333',
                                  }}
                                  onClick={() => {
                                    if (isEditable && !isEditing) startEdit(item.id, col.key, val);
                                  }}
                                >
                                  {isEditing ? (
                                    <input
                                      type={col.type === 'number' || col.type === 'percent' ? 'number' : 'text'}
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onBlur={commitEdit}
                                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
                                      autoFocus
                                      style={{
                                        width: '100%', fontSize: 13, padding: '4px 6px',
                                        border: '1px solid #85C1E9', borderRadius: 4,
                                        textAlign: align, boxSizing: 'border-box',
                                      }}
                                    />
                                  ) : col.key === 'tasting_note' && item.item_code ? (
                                    <a
                                      href={`${TASTING_NOTE_BASE_URL}/${item.item_code}.pdf`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      style={{
                                        color: tastingNoteSet.has(item.item_code) ? '#27ae60' : '#5A1515',
                                        textDecoration: 'underline', fontSize: 12, fontWeight: 600,
                                      }}
                                    >
                                      {tastingNoteSet.has(item.item_code) ? 'T-note' : 'T-note(x)'}
                                    </a>
                                  ) : (
                                    formatted
                                  )}
                                </td>
                              );
                            })}
                            <td style={qTdStyle}>
                              <button
                                onClick={() => deleteQuoteItem(item.id)}
                                style={{
                                  background: 'none', border: 'none', color: '#e74c3c',
                                  cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1,
                                }}
                                title="삭제"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#FFF2CC', fontWeight: 700 }}>
                          <td style={{ ...qTdStyle, textAlign: 'center' }}></td>
                          {visibleQuoteCols.map(col => {
                            let content = '';
                            if (col.key === 'product_name') content = '합계';
                            else if (col.key === 'quantity') content = String(totalQty);
                            else if (col.key === 'normal_total') content = formatWon(totalNormal);
                            else if (col.key === 'discount_total') content = formatWon(totalDiscount);
                            else if (col.key === 'retail_normal_total') content = formatWon(totalRetailNormal);
                            else if (col.key === 'retail_discount_total') content = formatWon(totalRetailDiscount);
                            const align: 'left' | 'right' | 'center' =
                              (col.type === 'currency' || col.type === 'computed') ? 'right'
                              : col.type === 'number' ? 'center' : 'left';
                            return (
                              <td key={col.key} style={{ ...qTdStyle, textAlign: align, fontWeight: 700 }}>{content}</td>
                            );
                          })}
                          <td style={qTdStyle}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Totals summary */}
                {quoteItems.length > 0 && (
                  <div style={{
                    marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap',
                    fontSize: 13, color: '#666', alignItems: 'center',
                  }}>
                    <span>품목 <strong>{quoteItems.length}</strong>개 / 수량 <strong>{totalQty}</strong></span>
                    <span>정상합계 <strong style={{ color: '#2c3e50' }}>{formatWon(totalNormal)}원</strong></span>
                    <span>할인합계 <strong style={{ color: '#5A1515' }}>{formatWon(totalDiscount)}원</strong></span>
                    {totalNormal > 0 && totalNormal !== totalDiscount && (
                      <span style={{ color: '#27ae60', fontWeight: 600 }}>
                        {formatWon(totalNormal - totalDiscount)}원 할인
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        </div>
        {/* ── end SIDE-BY-SIDE LAYOUT ── */}

        {/* ═══════════════════════════════════ */}
        {/* MOBILE: FLOATING CART BUTTON        */}
        {/* ═══════════════════════════════════ */}
        {isMobile && (
          <button
            onClick={() => setShowQuotePanel(true)}
            style={{
              position: 'fixed', bottom: 24, right: 24,
              width: 56, height: 56, borderRadius: '50%',
              background: '#5A1515', color: 'white',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(90,21,21,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, fontSize: 22,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {quoteItems.length > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: 'white', borderRadius: 10,
                padding: '2px 6px', fontSize: 11, fontWeight: 700,
                minWidth: 20, textAlign: 'center', lineHeight: '16px',
              }}>
                {quoteItems.length}
              </span>
            )}
          </button>
        )}

        {/* ═══════════════════════════════════ */}
        {/* MOBILE: QUOTE SLIDE PANEL           */}
        {/* ═══════════════════════════════════ */}
        {isMobile && showQuotePanel && (
          <>
            {/* Overlay */}
            <div
              className="quote-slide-overlay"
              onClick={() => setShowQuotePanel(false)}
              style={{
                position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)', zIndex: 899,
              }}
            />
            {/* Panel */}
            <div
              className="quote-slide-panel"
              style={{
                position: 'fixed', top: 56, right: 0, bottom: 0,
                width: '100%', maxWidth: 400, background: 'white',
                zIndex: 900, overflowY: 'auto',
                boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
              }}
            >
              {/* Panel header */}
              <div style={{
                position: 'sticky', top: 0, background: 'white', zIndex: 1,
                padding: '16px 16px 12px',
                borderBottom: '1px solid #F0EFED',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <button
                    onClick={() => setShowQuotePanel(false)}
                    style={{
                      background: 'none', border: 'none', fontSize: 20,
                      cursor: 'pointer', color: '#333', padding: 0, lineHeight: 1,
                    }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' }}>견적 목록</span>
                  {quoteItems.length > 0 && (
                    <span style={{
                      background: '#5A1515', color: 'white', borderRadius: 10,
                      padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    }}>
                      {quoteItems.length}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="거래처명"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    style={{
                      flex: 1, fontSize: 16, padding: '10px 12px',
                      borderRadius: 8, border: '1px solid #E5E5E5',
                      boxSizing: 'border-box', outline: 'none', minWidth: 0,
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDocSettings(!showDocSettings); }}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: '1px solid #E5E5E5',
                      background: showDocSettings ? 'rgba(90,21,21,0.08)' : 'white',
                      cursor: 'pointer', fontSize: 15, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="문서 설정"
                  >
                    📄
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQuoteColumnSettings(!showQuoteColumnSettings); }}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: '1px solid #E5E5E5',
                      background: showQuoteColumnSettings ? 'rgba(90,21,21,0.08)' : 'white',
                      cursor: 'pointer', fontSize: 15, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="컬럼 설정"
                  >
                    ⚙
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div style={{ padding: 16 }}>

                {/* Mobile Doc settings */}
                {showDocSettings && (
                  <div style={{
                    marginBottom: 12, padding: 14, background: '#fafaf8',
                    borderRadius: 8, border: '1px solid #F0EFED',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, color: '#2D2D2D' }}>문서 설정</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {([
                        ['companyName', '회사명'], ['address', '주소/연락처'], ['addressEn', '영문주소'],
                        ['websiteUrl', '웹사이트/SNS'], ['sender', '발신'], ['title', '제목'],
                        ['content1', '내용 1'], ['content2', '내용 2'], ['content3', '내용 3'],
                        ['unit', '단위'], ['representative', '대표자'], ['sealText', '직인'],
                      ] as [string, string][]).map(([key, label]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#555', minWidth: 72, flexShrink: 0 }}>{label}</label>
                          <input
                            type="text"
                            value={(docSettings as any)[key] || ''}
                            onChange={e => setDocSettings(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              flex: 1, fontSize: 16, padding: '5px 8px', borderRadius: 6,
                              border: '1px solid #E5E5E5', minWidth: 0, outline: 'none',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setDocSettings(activeTab === 'CDV' ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS)}
                      style={{
                        marginTop: 8, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid #E5E5E5', background: 'white',
                        fontSize: '0.72rem', cursor: 'pointer', color: '#666',
                      }}
                    >
                      기본값 초기화
                    </button>
                  </div>
                )}

                {/* Mobile Quote column settings */}
                {showQuoteColumnSettings && (
                  <div style={{
                    marginBottom: 12, padding: 14, background: '#fafaf8',
                    borderRadius: 8, border: '1px solid #F0EFED',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: '#2D2D2D' }}>견적 컬럼 (체크 + 순서 변경)</div>
                    {/* 활성 컬럼 순서 변경 */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: 4 }}>표시 순서 (◀▶ 로 이동)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {visibleQuoteColumns.map((key, idx) => {
                          const col = QUOTE_COLUMNS.find(c => c.key === key);
                          if (!col) return null;
                          return (
                            <div key={key} style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              padding: '3px 6px', borderRadius: 6,
                              background: '#fff', border: '1px solid rgba(90,21,21,0.2)',
                              fontSize: 11,
                            }}>
                              <button
                                onClick={() => { if (idx === 0) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a; }); }}
                                disabled={idx === 0}
                                style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: '0 2px', fontSize: 11, color: idx === 0 ? '#ddd' : '#5A1515' }}
                              >◀</button>
                              <span style={{ fontWeight: 600, color: '#2D2D2D' }}>{col.label}</span>
                              <button
                                onClick={() => { if (idx === visibleQuoteColumns.length-1) return; setVisibleQuoteColumns(prev => { const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; }); }}
                                disabled={idx === visibleQuoteColumns.length - 1}
                                style={{ background: 'none', border: 'none', cursor: idx === visibleQuoteColumns.length-1 ? 'default' : 'pointer', padding: '0 2px', fontSize: 11, color: idx === visibleQuoteColumns.length-1 ? '#ddd' : '#5A1515' }}
                              >▶</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* 컬럼 표시/숨김 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {QUOTE_COLUMNS.map(col => (
                        <label key={col.key} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 12, cursor: 'pointer', padding: '4px 8px',
                          borderRadius: 6,
                          background: visibleQuoteColumns.includes(col.key) ? 'rgba(90,21,21,0.06)' : '#fff',
                          border: `1px solid ${visibleQuoteColumns.includes(col.key) ? 'rgba(90,21,21,0.2)' : '#E5E5E5'}`,
                        }}>
                          <input
                            type="checkbox"
                            checked={visibleQuoteColumns.includes(col.key)}
                            onChange={() => {
                              setVisibleQuoteColumns(prev =>
                                prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key]
                              );
                            }}
                            style={{ width: 14, height: 14 }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel body content */}
              <div style={{ padding: 16 }}>
                {quoteItems.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2D2D2D' }}>No items yet</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 4 }}>검색 결과에서 + 버튼으로 추가</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {quoteItems.map((item, idx) => {
                      const discounted = calcDiscountedPrice(item.supply_price, item.discount_rate, item.discounted_price);
                      const normalTotal = item.supply_price * item.quantity;
                      const discountTotal = discounted * item.quantity;
                      return (
                        <div
                          key={item.id}
                          onClick={() => openBottomSheet(item)}
                          style={{
                            padding: 14, background: '#fafaf8',
                            borderRadius: 10, border: '1px solid #F0EFED',
                            cursor: 'pointer', position: 'relative',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 6, right: 8,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <button
                              onClick={e => { e.stopPropagation(); moveItem(idx, 'up'); }}
                              disabled={idx === 0}
                              style={{
                                background: 'none', border: 'none', padding: '2px 4px',
                                color: idx === 0 ? '#ddd' : '#888', fontSize: 14,
                                cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1,
                              }}
                            >▲</button>
                            <button
                              onClick={e => { e.stopPropagation(); moveItem(idx, 'down'); }}
                              disabled={idx === quoteItems.length - 1}
                              style={{
                                background: 'none', border: 'none', padding: '2px 4px',
                                color: idx === quoteItems.length - 1 ? '#ddd' : '#888', fontSize: 14,
                                cursor: idx === quoteItems.length - 1 ? 'default' : 'pointer', lineHeight: 1,
                              }}
                            >▼</button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteQuoteItem(item.id); }}
                              style={{
                                background: 'none', border: 'none', color: '#ccc',
                                fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                              }}
                            >×</button>
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                            #{idx + 1} {item.item_code}
                            {item.vintage && ` · ${item.vintage}`}
                            {item.country && ` · ${item.country}`}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, paddingRight: 24 }}>
                            {item.korean_name || item.product_name}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 11, color: '#888' }}>공급가</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWon(item.supply_price)}</div>
                              </div>
                              {item.discount_rate > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, color: '#888' }}>할인가</div>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: '#5A1515' }}>
                                    {formatWon(discounted)} ({formatPercent(item.discount_rate)})
                                  </div>
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#888' }}>수량</div>
                              <div style={{ fontSize: 16, fontWeight: 700 }}>{item.quantity}</div>
                            </div>
                          </div>
                          <div style={{
                            marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee',
                            display: 'flex', justifyContent: 'space-between', fontSize: 12,
                          }}>
                            <span style={{ color: '#666' }}>정상 {formatWon(normalTotal)}원</span>
                            <span style={{ color: '#5A1515', fontWeight: 600 }}>할인 {formatWon(discountTotal)}원</span>
                          </div>
                          {item.note && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>비고: {item.note}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Totals */}
                {quoteItems.length > 0 && (
                  <div style={{
                    marginTop: 16, padding: 12, background: '#FFF2CC',
                    borderRadius: 8, fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#666' }}>품목 {quoteItems.length}개 / 수량 {totalQty}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#666' }}>정상합계</span>
                      <span style={{ fontWeight: 600 }}>{formatWon(totalNormal)}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#5A1515' }}>
                      <span>할인합계</span>
                      <span>{formatWon(totalDiscount)}원</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExport}
                    disabled={exporting || quoteItems.length === 0}
                    style={{
                      flex: 1, height: 44, borderRadius: 8, border: 'none',
                      background: quoteItems.length > 0 ? '#1a1a2e' : '#E5E5E5',
                      color: quoteItems.length > 0 ? 'white' : '#999',
                      fontSize: 14, fontWeight: 600, cursor: quoteItems.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: exporting ? 0.6 : 1,
                    }}
                  >
                    {exporting ? '생성 중...' : 'Excel 출력'}
                  </button>
                  {quoteItems.length > 0 && (
                    <button
                      onClick={clearAllQuote}
                      style={{
                        height: 44, padding: '0 16px', borderRadius: 8,
                        border: '1px solid #e74c3c', background: 'white',
                        color: '#e74c3c', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════ */}
        {/* MOBILE: BOTTOM SHEET (quote edit)   */}
        {/* ═══════════════════════════════════ */}
        {bottomSheetItem && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 2000,
              display: 'flex', alignItems: 'flex-end',
            }}
            onClick={() => setBottomSheetItem(null)}
          >
            <div
              style={{
                width: '100%', background: 'white',
                borderRadius: '12px 12px 0 0', padding: '20px 16px',
                maxHeight: '85vh', overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: 40, height: 4, background: '#ddd', borderRadius: 2,
                margin: '0 auto 16px',
              }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, paddingRight: 20 }}>
                {bottomSheetItem.product_name}
              </h3>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                {bottomSheetItem.item_code}
                {bottomSheetItem.vintage && ` · ${bottomSheetItem.vintage}`}
                {bottomSheetItem.country && ` · ${bottomSheetItem.country}`}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>수량</label>
                  <input
                    type="number"
                    value={sheetValues.quantity}
                    onChange={e => setSheetValues(v => ({ ...v, quantity: e.target.value }))}
                    style={sheetInputStyle}
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>할인율 (%)</label>
                  <input
                    type="number"
                    value={sheetValues.discount_rate}
                    onChange={e => {
                      const rate = parseInt(e.target.value) || 0;
                      const dp = Math.round(bottomSheetItem.supply_price * (1 - rate / 100));
                      setSheetValues(v => ({ ...v, discount_rate: e.target.value, discounted_price: String(dp) }));
                    }}
                    style={sheetInputStyle}
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label style={labelStyle}>할인가 (원)</label>
                  <input
                    type="number"
                    value={sheetValues.discounted_price}
                    onChange={e => {
                      const dp = parseInt(e.target.value) || 0;
                      const rate = bottomSheetItem.supply_price > 0
                        ? Math.round((bottomSheetItem.supply_price - dp) / bottomSheetItem.supply_price * 100)
                        : 0;
                      setSheetValues(v => ({ ...v, discounted_price: e.target.value, discount_rate: String(rate) }));
                    }}
                    style={sheetInputStyle}
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>비고</label>
                  <textarea
                    value={sheetValues.note}
                    onChange={e => setSheetValues(v => ({ ...v, note: e.target.value }))}
                    style={{ ...sheetInputStyle, minHeight: 60, resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>테이스팅노트</label>
                  <textarea
                    value={sheetValues.tasting_note}
                    onChange={e => setSheetValues(v => ({ ...v, tasting_note: e.target.value }))}
                    style={{ ...sheetInputStyle, minHeight: 60, resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginTop: 16, padding: 12, background: '#fafaf8', borderRadius: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#666' }}>공급가</span>
                  <span>{formatWon(bottomSheetItem.supply_price)}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#666' }}>할인가</span>
                  <span>
                    {formatWon(parseInt(sheetValues.discounted_price) || 0)}원
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#5A1515' }}>
                  <span>할인합계</span>
                  <span>
                    {formatWon(
                      (parseInt(sheetValues.discounted_price) || 0) * (parseInt(sheetValues.quantity) || 0)
                    )}원
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setBottomSheetItem(null)}
                  style={{
                    flex: 1, height: 44, borderRadius: 8,
                    border: '1px solid #E5E5E5', background: 'white',
                    color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={saveBottomSheet}
                  style={{
                    flex: 1, height: 44, borderRadius: 8, border: 'none',
                    background: '#5A1515', color: 'white',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* TASTING NOTE MODAL                  */}
      {/* ═══════════════════════════════════ */}
      {showTastingNote && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={() => setShowTastingNote(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: 12,
              width: '95vw', maxWidth: '1400px', height: '95vh',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(240,236,230,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#1a1a2e', color: '#f0ece6',
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>테이스팅 노트</div>
                <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'rgba(240,236,230,0.6)' }}>
                  {selectedItemNo} - {selectedWineName}
                </div>
              </div>
              <button
                onClick={() => setShowTastingNote(false)}
                style={{
                  background: 'rgba(240,236,230,0.1)', border: 'none',
                  color: '#f0ece6', fontSize: 20, width: 36, height: 36,
                  borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              flex: 1, overflow: 'auto', padding: 16,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {tastingNoteLoading ? (
                <div style={{ textAlign: 'center', color: '#999' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>...</div>
                  <div>테이스팅 노트를 불러오는 중...</div>
                </div>
              ) : tastingNoteSource === 'db' && dbTastingNote ? (() => {
                const tn = dbTastingNote;
                const wi = dbWineInfo;
                const nameKr = (wi?.item_name_kr || selectedWineName || '').replace(/^[A-Za-z]{2}\s+/, '');
                const nameEn = wi?.item_name_en || '';
                const country = wi?.country_en || tn.country || '';
                const region = wi?.region || tn.region || '';
                const grapes = wi?.grape_varieties || tn.grape_varieties || '';
                const vintage = wi?.vintage || '';
                const alcohol = wi?.alcohol || '';
                const wineryTag = (tn.winery_description || '').split('.')[0]?.trim() || '';
                const awards = tn.awards && tn.awards !== 'N/A' ? tn.awards : '';
                return (
                <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '4px 0' }}>
                  {/* Download buttons */}
                  {originalPdfUrl && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, maxWidth: 600, margin: '0 auto 6px auto', padding: '0 8px' }}>
                      <button onClick={() => handleDownload(originalPdfUrl, `${selectedItemNo}.pdf`)}
                        style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: '#5A1515', color: 'white', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer' }}>PDF</button>
                      <button onClick={() => handleDownload(originalPdfUrl.replace('.pdf', '.pptx'), `${selectedItemNo}.pptx`)}
                        style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: '#1a1a2e', color: 'white', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer' }}>PPTX</button>
                    </div>
                  )}
                  {/* Original-style tasting note card */}
                  <div style={{
                    maxWidth: 600, margin: '0 auto', background: '#fff',
                    borderRadius: 10, overflow: 'hidden',
                    border: '1px solid #E0D5C8', boxShadow: '0 2px 12px rgba(90,21,21,0.08)',
                  }}>
                    {/* Header: winery tagline */}
                    {wineryTag && (
                      <div style={{ padding: '10px 16px 0', fontSize: 11, color: '#8A8A8A', lineHeight: 1.4 }}>{wineryTag}</div>
                    )}
                    {/* Burgundy divider */}
                    <div style={{ margin: '8px 16px 0', height: 2, background: '#722F37' }} />
                    <div style={{ margin: '2px 16px 0', height: 1, background: '#D4C4A8' }} />
                    {/* Wine name card */}
                    <div style={{ margin: '12px 16px 0', padding: '12px 16px', background: '#F9F3F4', borderRadius: 8, border: '1px solid #E0D5C8' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#5A252C', lineHeight: 1.35 }}>{nameKr}</div>
                      {nameEn && <div style={{ fontSize: 13, color: '#5A5A5A', fontStyle: 'italic', marginTop: 4 }}>{nameEn}</div>}
                    </div>
                    {/* Info badges */}
                    <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(country || region) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>지역</span>
                          <span style={{ fontSize: 13, color: '#2C2C2C' }}>{region ? `${country}, ${region}` : country}</span>
                        </div>
                      )}
                      {grapes && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>품종</span>
                          <span style={{ fontSize: 13, color: '#2C2C2C' }}>{grapes}</span>
                        </div>
                      )}
                      {vintage && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>빈티지</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#722F37' }}>{vintage.length === 2 ? (parseInt(vintage) >= 50 ? `19${vintage}` : `20${vintage}`) : vintage}</span>
                          {tn.vintage_note && <span style={{ fontSize: 11, color: '#5A5A5A', lineHeight: 1.4, marginTop: 2 }}>{tn.vintage_note}</span>}
                        </div>
                      )}
                    </div>
                    {/* Winemaking */}
                    {tn.winemaking && (
                      <div style={{ padding: '12px 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700 }}>양조</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#2C2C2C', lineHeight: 1.6 }}>
                          {tn.winemaking}
                          {alcohol && <span style={{ color: '#5A5A5A' }}>{'\n'}알코올: {alcohol}</span>}
                        </div>
                      </div>
                    )}
                    {/* Tasting Note section */}
                    <div style={{ margin: '14px 16px 0', padding: '14px 16px', background: '#F6EFF0', borderRadius: 8, border: '1px solid #E0D5C8' }}>
                      <span style={{ padding: '2px 14px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>TASTING NOTE</span>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Color', value: tn.color_note },
                          { label: 'Nose', value: tn.nose_note },
                          { label: 'Palate', value: tn.palate_note },
                          { label: 'Potential', value: tn.aging_potential },
                        ].filter(x => x.value).map((x, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#722F37', fontStyle: 'italic', marginBottom: 2 }}>{x.label}</div>
                            <div style={{ fontSize: 12.5, color: '#2C2C2C', lineHeight: 1.6 }}>{x.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Food pairing */}
                    {tn.food_pairing && (
                      <div style={{ padding: '12px 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, background: '#722F37', color: '#fff', fontSize: 11, fontWeight: 700 }}>푸드 페어링</span>
                          {tn.serving_temp && <span style={{ fontSize: 11, color: '#8A8A8A' }}>{tn.serving_temp}</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#2C2C2C', lineHeight: 1.6 }}>{tn.food_pairing}</div>
                      </div>
                    )}
                    {/* Awards */}
                    {awards && (
                      <div style={{ margin: '12px 16px 0', padding: '8px 12px', borderTop: '1px solid #D4C4A8' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#B8976A', letterSpacing: '0.05em' }}>AWARDS</span>
                        <span style={{ fontSize: 12, color: '#2C2C2C', marginLeft: 8 }}>{awards}</span>
                      </div>
                    )}
                    {/* Footer */}
                    <div style={{ margin: '10px 16px 0', height: 2, background: '#722F37' }} />
                    <div style={{ height: 1, margin: '2px 16px 0', background: '#D4C4A8' }} />
                    <div style={{ padding: '8px 16px 12px', fontSize: 10, color: '#8A8A8A' }}>
                      T. 02-786-3136 | www.cavedevin.com
                    </div>
                  </div>
                </div>
                );
              })() : tastingNoteSource === 'pdf' && tastingNoteUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      onClick={() => handleDownload(originalPdfUrl, `${selectedItemNo}.pdf`)}
                      style={{
                        padding: '5px 14px', borderRadius: 6, border: 'none',
                        background: '#5A1515', color: 'white', fontWeight: 600,
                        fontSize: '0.75rem', cursor: 'pointer',
                      }}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => handleDownload(originalPdfUrl.replace('.pdf', '.pptx'), `${selectedItemNo}.pptx`)}
                      style={{
                        padding: '5px 14px', borderRadius: 6, border: 'none',
                        background: '#1a1a2e', color: 'white', fontWeight: 600,
                        fontSize: '0.75rem', cursor: 'pointer',
                      }}
                    >
                      PPTX
                    </button>
                  </div>
                  <div style={{
                    flex: 1, background: '#f5f5f5', borderRadius: 8,
                    overflow: 'hidden', border: '1px solid #E5E5E5', position: 'relative',
                  }}>
                    <iframe
                      src={`${tastingNoteUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                      title="테이스팅 노트 PDF"
                      width="100%" height="100%"
                      style={{ border: 'none' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#999' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>-</div>
                  <div>테이스팅 노트를 찾을 수 없습니다.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════

const qThStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #E5E5E5',
  textAlign: 'center',
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const qTdStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#555',
  marginBottom: 4,
};

const sheetInputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 16,
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #E5E5E5',
  boxSizing: 'border-box',
  outline: 'none',
};
