'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── 타입 ──
interface QuoteItem {
  id: number;
  item_code: string;
  country: string;
  brand: string;
  region: string;
  image_url: string;
  vintage: string;
  product_name: string;
  english_name: string;
  korean_name: string;
  supply_price: number;
  retail_price: number;
  discount_rate: number;
  discounted_price: number;
  quantity: number;
  note: string;
  tasting_note: string;
  created_at: string;
  updated_at: string;
}

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  discount_price: number;
  wholesale_price: number;
  retail_price: number;
  min_price: number;
  available_stock: number;
  bonded_warehouse?: number;
  anseong_warehouse?: number;
  incoming_stock: number;
  sales_30days: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

type ColumnKey =
  | 'item_code' | 'country' | 'brand' | 'region' | 'image_url'
  | 'vintage' | 'product_name' | 'english_name' | 'korean_name'
  | 'supply_price' | 'retail_price' | 'discount_rate'
  | 'discounted_price' | 'quantity' | 'normal_total' | 'discount_total'
  | 'note' | 'tasting_note';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  editable?: boolean;
  type?: 'text' | 'number' | 'percent' | 'currency' | 'computed';
}

const ALL_COLUMNS: ColumnConfig[] = [
  { key: 'item_code', label: '품목코드' },
  { key: 'country', label: '국가' },
  { key: 'brand', label: '브랜드' },
  { key: 'region', label: '지역' },
  { key: 'image_url', label: '이미지' },
  { key: 'vintage', label: '빈티지' },
  { key: 'product_name', label: '상품명' },
  { key: 'english_name', label: '영문명' },
  { key: 'korean_name', label: '한글명' },
  { key: 'supply_price', label: '공급가', type: 'currency' },
  { key: 'retail_price', label: '소비자가', type: 'currency' },
  { key: 'discount_rate', label: '할인율', editable: true, type: 'percent' },
  { key: 'discounted_price', label: '할인가', type: 'computed' },
  { key: 'quantity', label: '수량', editable: true, type: 'number' },
  { key: 'normal_total', label: '정상공급가합계', type: 'computed' },
  { key: 'discount_total', label: '할인공급가합계', type: 'computed' },
  { key: 'note', label: '비고', editable: true, type: 'text' },
  { key: 'tasting_note', label: '테이스팅노트', editable: true, type: 'text' },
];

const DEFAULT_VISIBLE: ColumnKey[] = [
  'item_code', 'product_name', 'supply_price', 'discount_rate',
  'discounted_price', 'quantity', 'normal_total', 'discount_total', 'note',
];

// ── 유틸 ──
function formatWon(n: number): string {
  if (!n && n !== 0) return '';
  return n.toLocaleString('ko-KR');
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function calcDiscountedPrice(price: number, rate: number): number {
  return Math.round(price * (1 - rate));
}

// ── 메인 컴포넌트 ──
export default function QuotePage() {
  // 견적 데이터
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');

  // 재고 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSource, setSearchSource] = useState<'CDV' | 'DL'>('CDV');
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 인라인 편집
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // 모바일 바텀시트
  const [bottomSheetItem, setBottomSheetItem] = useState<QuoteItem | null>(null);
  const [sheetValues, setSheetValues] = useState<Record<string, any>>({});

  // 컬럼 설정
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // 반응형
  const [isMobile, setIsMobile] = useState(false);

  // 엑셀 다운로드
  const [exporting, setExporting] = useState(false);
  const [templateKey, setTemplateKey] = useState('cdv1');

  // ── 초기화 ──
  useEffect(() => {
    fetchItems();
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);

    // localStorage에서 컬럼 설정 로드
    const saved = localStorage.getItem('quote_visible_columns');
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved));
      } catch { /* ignore */ }
    }

    return () => mq.removeEventListener('change', handler);
  }, []);

  // 컬럼 설정 저장
  useEffect(() => {
    localStorage.setItem('quote_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // ── API 호출 ──
  async function fetchItems() {
    try {
      const res = await fetch('/api/quote');
      const data = await res.json();
      if (data.success) setItems(data.items || []);
    } catch (e) {
      console.error('Failed to fetch quote items:', e);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(inv: InventoryItem) {
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_code: inv.item_no,
          product_name: inv.item_name,
          supply_price: inv.supply_price,
          retail_price: inv.retail_price || 0,
          country: inv.country || '',
          vintage: inv.vintage || '',
          quantity: 1,
          discount_rate: 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      }
    } catch (e) {
      console.error('Failed to add item:', e);
    }
  }

  async function deleteItem(id: number) {
    try {
      await fetch(`/api/quote?id=${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }

  async function updateItem(id: number, fields: Record<string, any>) {
    try {
      const res = await fetch('/api/quote', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(i => (i.id === id ? data.item : i)));
      }
    } catch (e) {
      console.error('Failed to update:', e);
    }
  }

  async function clearAll() {
    if (!confirm('견적서의 모든 항목을 삭제하시겠습니까?')) return;
    for (const item of items) {
      await fetch(`/api/quote?id=${item.id}`, { method: 'DELETE' });
    }
    setItems([]);
  }

  // ── 재고 검색 (디바운스) ──
  const doSearch = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const endpoint = searchSource === 'CDV'
          ? `/api/inventory/search?q=${encodeURIComponent(q)}`
          : `/api/inventory/dl/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchSource]);

  useEffect(() => {
    doSearch(searchQuery);
  }, [searchQuery, doSearch]);

  // ── 엑셀 다운로드 ──
  async function handleExport() {
    setExporting(true);
    try {
      const columnsParam = encodeURIComponent(JSON.stringify(visibleColumns));
      const res = await fetch(`/api/quote/export?client_name=${encodeURIComponent(clientName)}&template=${templateKey}&columns=${columnsParam}`);
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

  // ── 인라인 편집 핸들러 ──
  function startEdit(id: number, key: string, currentValue: any) {
    setEditCell({ id, key });
    if (key === 'discount_rate') {
      setEditValue(String(Math.round((currentValue || 0) * 100)));
    } else {
      setEditValue(String(currentValue ?? ''));
    }
  }

  function commitEdit() {
    if (!editCell) return;
    const { id, key } = editCell;
    let value: any = editValue;

    if (key === 'quantity') {
      value = Math.max(0, parseInt(value) || 0);
    } else if (key === 'discount_rate') {
      value = Math.min(100, Math.max(0, parseInt(value) || 0)) / 100;
    } else if (key === 'supply_price') {
      value = Math.max(0, parseInt(value) || 0);
    }

    updateItem(id, { [key]: value });
    setEditCell(null);
    setEditValue('');
  }

  // ── 바텀시트 핸들러 ──
  function openBottomSheet(item: QuoteItem) {
    setBottomSheetItem(item);
    setSheetValues({
      quantity: item.quantity,
      discount_rate: Math.round(item.discount_rate * 100),
      note: item.note || '',
      tasting_note: item.tasting_note || '',
    });
  }

  function saveBottomSheet() {
    if (!bottomSheetItem) return;
    updateItem(bottomSheetItem.id, {
      quantity: Math.max(0, parseInt(sheetValues.quantity) || 0),
      discount_rate: Math.min(100, Math.max(0, parseInt(sheetValues.discount_rate) || 0)) / 100,
      note: sheetValues.note || '',
      tasting_note: sheetValues.tasting_note || '',
    });
    setBottomSheetItem(null);
  }

  // ── 셀 값 계산 ──
  function getCellValue(item: QuoteItem, key: ColumnKey): string | number {
    switch (key) {
      case 'discounted_price':
        return calcDiscountedPrice(item.supply_price, item.discount_rate);
      case 'normal_total':
        return item.supply_price * item.quantity;
      case 'discount_total':
        return calcDiscountedPrice(item.supply_price, item.discount_rate) * item.quantity;
      case 'discount_rate':
        return item.discount_rate;
      default:
        return (item as any)[key] ?? '';
    }
  }

  function formatCellValue(item: QuoteItem, col: ColumnConfig): string {
    const val = getCellValue(item, col.key);
    if (col.type === 'currency' || col.type === 'computed') {
      return formatWon(Number(val));
    }
    if (col.type === 'percent') {
      return formatPercent(Number(val));
    }
    return String(val);
  }

  // ── 합계 계산 ──
  const totalNormal = items.reduce((s, i) => s + i.supply_price * i.quantity, 0);
  const totalDiscount = items.reduce(
    (s, i) => s + calcDiscountedPrice(i.supply_price, i.discount_rate) * i.quantity,
    0
  );
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // ── 보이는 컬럼 ──
  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

  // ═══════════════ 렌더링 ═══════════════

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666' }}>견적서를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', background: '#F8F9FA', padding: isMobile ? '12px' : '24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── 상단 헤더 ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          marginBottom: 16, justifyContent: 'space-between'
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
            견적서
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="거래처명"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              style={{
                fontSize: 16, padding: '8px 12px', borderRadius: 8,
                border: '1px solid #ddd', width: 160, background: 'white'
              }}
            />
            <select
              value={templateKey}
              onChange={e => setTemplateKey(e.target.value)}
              style={{
                fontSize: 16, padding: '8px 10px', borderRadius: 8,
                border: '1px solid #ddd', background: 'white', cursor: 'pointer',
              }}
            >
              <option value="cdv1">영업1부 와인</option>
              <option value="cdv2">영업2부 와인</option>
              <option value="dl1">영업1부 글라스</option>
              <option value="dl2">영업2부 글라스</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting || items.length === 0}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: items.length > 0 ? '#2E7D32' : '#ccc',
                color: 'white', fontWeight: 600, fontSize: 14,
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? '생성 중...' : '엑셀 다운로드'}
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #8B1538', cursor: 'pointer',
                background: showSearch ? '#8B1538' : 'white',
                color: showSearch ? 'white' : '#8B1538', fontWeight: 600, fontSize: 14,
              }}
            >
              {showSearch ? '검색 닫기' : '+ 품목 추가'}
            </button>
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer',
                background: showColumnSettings ? '#f0f0f0' : 'white', fontSize: 14,
              }}
              title="컬럼 표시/숨김"
            >
              ⚙
            </button>
            {items.length > 0 && (
              <button
                onClick={clearAll}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid #e74c3c', cursor: 'pointer',
                  background: 'white', color: '#e74c3c', fontWeight: 600, fontSize: 14,
                }}
              >
                전체 삭제
              </button>
            )}
          </div>
        </div>

        {/* ── 컬럼 설정 ── */}
        {showColumnSettings && (
          <div style={{
            background: 'white', borderRadius: 12, padding: 16, marginBottom: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>컬럼 표시/숨김</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 13, cursor: 'pointer', padding: '4px 8px',
                  borderRadius: 6, background: visibleColumns.includes(col.key) ? '#EBF5FB' : '#f5f5f5',
                  border: `1px solid ${visibleColumns.includes(col.key) ? '#85C1E9' : '#ddd'}`,
                }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => {
                      setVisibleColumns(prev =>
                        prev.includes(col.key)
                          ? prev.filter(k => k !== col.key)
                          : [...prev, col.key]
                      );
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── 재고 검색 영역 ── */}
        {showSearch && (
          <div style={{
            background: 'white', borderRadius: 12, padding: 16, marginBottom: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee'
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd' }}>
                {(['CDV', 'DL'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setSearchSource(tab); setSearchResults([]); setSearchQuery(''); }}
                    style={{
                      padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: searchSource === tab ? '#8B1538' : 'white',
                      color: searchSource === tab ? 'white' : '#333',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="품목명 / 코드 / 브랜드 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, fontSize: 16, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #ddd', minWidth: 0,
                }}
              />
            </div>

            {/* 검색 결과 */}
            {isSearching && <p style={{ color: '#888', fontSize: 13 }}>검색 중...</p>}
            {searchResults.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: 8 }}>
                {searchResults.slice(0, 50).map((inv, idx) => (
                  <div key={`${inv.item_no}-${idx}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px',
                    borderBottom: '1px solid #f5f5f5', fontSize: 13,
                  }}>
                    <button
                      onClick={() => addItem(inv)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: 'none',
                        background: '#8B1538', color: 'white', fontSize: 16,
                        cursor: 'pointer', flexShrink: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                    <span style={{ color: '#888', minWidth: 70 }}>{inv.item_no}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{inv.item_name}</span>
                    <span style={{ color: '#333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatWon(inv.supply_price)}원
                    </span>
                    <span style={{
                      color: inv.available_stock > 0 ? '#27ae60' : '#e74c3c',
                      fontSize: 12, whiteSpace: 'nowrap',
                    }}>
                      재고 {inv.available_stock}
                    </span>
                    {inv.bonded_warehouse != null && inv.bonded_warehouse > 0 && (
                      <span style={{ color: '#2980b9', fontSize: 12, whiteSpace: 'nowrap' }}>
                        보세 {inv.bonded_warehouse}
                      </span>
                    )}
                  </div>
                ))}
                {searchResults.length > 50 && (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: 8 }}>
                    {searchResults.length}개 중 50개 표시
                  </p>
                )}
              </div>
            )}
            {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
              <p style={{ color: '#888', fontSize: 13 }}>검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {/* ── 합계 바 ── */}
        {items.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee',
            display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                품목 <strong>{items.length}</strong>개 / 수량 <strong>{totalQty}</strong>
              </span>
              <span style={{ fontSize: 13, color: '#333' }}>
                정상합계 <strong style={{ color: '#2c3e50' }}>{formatWon(totalNormal)}원</strong>
              </span>
              <span style={{ fontSize: 13, color: '#333' }}>
                할인합계 <strong style={{ color: '#8B1538' }}>{formatWon(totalDiscount)}원</strong>
              </span>
            </div>
            {totalNormal > 0 && totalNormal !== totalDiscount && (
              <span style={{ fontSize: 12, color: '#27ae60', fontWeight: 600 }}>
                {formatWon(totalNormal - totalDiscount)}원 할인
              </span>
            )}
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {items.length === 0 && (
          <div style={{
            background: 'white', borderRadius: 12, padding: 48, textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee',
          }}>
            <p style={{ fontSize: 16, color: '#888', marginBottom: 8 }}>견적서가 비어있습니다.</p>
            <p style={{ fontSize: 13, color: '#aaa' }}>
              상단의 "품목 추가" 버튼을 눌러 재고에서 품목을 검색하세요.
            </p>
          </div>
        )}

        {/* ── 데스크탑: 테이블 뷰 ── */}
        {!isMobile && items.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#D6EAF8' }}>
                    <th style={{ ...thStyle, width: 36 }}>No.</th>
                    {visibleCols.map(col => (
                      <th key={col.key} style={{
                        ...thStyle,
                        textAlign: (col.type === 'currency' || col.type === 'computed' || col.type === 'number') ? 'right' : 'center',
                      }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ ...thStyle, width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                      {visibleCols.map(col => {
                        const isEditing = editCell?.id === item.id && editCell?.key === col.key;
                        const isEditable = col.editable;
                        const val = getCellValue(item, col.key);
                        const formatted = formatCellValue(item, col);
                        const align: 'left' | 'right' | 'center' =
                          (col.type === 'currency' || col.type === 'computed') ? 'right'
                          : col.type === 'number' ? 'center'
                          : col.type === 'percent' ? 'center'
                          : 'left';

                        return (
                          <td
                            key={col.key}
                            style={{
                              ...tdStyle,
                              textAlign: align,
                              cursor: isEditable ? 'pointer' : 'default',
                              background: isEditing ? '#FFF9C4' : 'transparent',
                              fontWeight: (col.key === 'product_name') ? 600 : 400,
                              color: col.key === 'discount_total' ? '#8B1538' : '#333',
                            }}
                            onClick={() => {
                              if (isEditable && !isEditing) {
                                startEdit(item.id, col.key, val);
                              }
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
                            ) : (
                              formatted
                            )}
                          </td>
                        );
                      })}
                      <td style={tdStyle}>
                        <button
                          onClick={() => deleteItem(item.id)}
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
                {/* 합계 행 */}
                <tfoot>
                  <tr style={{ background: '#FFF2CC', fontWeight: 700 }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}></td>
                    {visibleCols.map(col => {
                      let content = '';
                      if (col.key === 'product_name') content = '합계';
                      else if (col.key === 'quantity') content = String(totalQty);
                      else if (col.key === 'normal_total') content = formatWon(totalNormal);
                      else if (col.key === 'discount_total') content = formatWon(totalDiscount);

                      const align: 'left' | 'right' | 'center' =
                        (col.type === 'currency' || col.type === 'computed') ? 'right'
                        : col.type === 'number' ? 'center' : 'left';

                      return (
                        <td key={col.key} style={{ ...tdStyle, textAlign: align, fontWeight: 700 }}>
                          {content}
                        </td>
                      );
                    })}
                    <td style={tdStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── 모바일: 카드 뷰 ── */}
        {isMobile && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, idx) => {
              const discounted = calcDiscountedPrice(item.supply_price, item.discount_rate);
              const normalTotal = item.supply_price * item.quantity;
              const discountTotal = discounted * item.quantity;

              return (
                <div
                  key={item.id}
                  onClick={() => openBottomSheet(item)}
                  style={{
                    background: 'white', borderRadius: 12, padding: 14,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee',
                    cursor: 'pointer', position: 'relative',
                  }}
                >
                  {/* 삭제 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    style={{
                      position: 'absolute', top: 8, right: 10,
                      background: 'none', border: 'none', color: '#ccc',
                      fontSize: 18, cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    ×
                  </button>

                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                    #{idx + 1} {item.item_code}
                    {item.vintage && ` · ${item.vintage}`}
                    {item.country && ` · ${item.country}`}
                    {item.brand && ` · ${item.brand}`}
                  </div>
                  {item.english_name && (
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 2, paddingRight: 24 }}>
                      {item.english_name}
                    </div>
                  )}
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
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#8B1538' }}>
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
                    marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0',
                    display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  }}>
                    <span style={{ color: '#666' }}>정상합계 {formatWon(normalTotal)}원</span>
                    <span style={{ color: '#8B1538', fontWeight: 600 }}>할인합계 {formatWon(discountTotal)}원</span>
                  </div>
                  {item.note && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>비고: {item.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 모바일 바텀시트 ── */}
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
                borderRadius: '16px 16px 0 0', padding: '20px 16px',
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
                    onChange={e => setSheetValues(v => ({ ...v, discount_rate: e.target.value }))}
                    style={sheetInputStyle}
                    min={0}
                    max={100}
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

              {/* 미리보기 */}
              <div style={{
                marginTop: 16, padding: 12, background: '#F8F9FA', borderRadius: 8, fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#666' }}>공급가</span>
                  <span>{formatWon(bottomSheetItem.supply_price)}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#666' }}>할인가</span>
                  <span>
                    {formatWon(calcDiscountedPrice(
                      bottomSheetItem.supply_price,
                      (parseInt(sheetValues.discount_rate) || 0) / 100
                    ))}원
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#8B1538' }}>
                  <span>할인합계</span>
                  <span>
                    {formatWon(
                      calcDiscountedPrice(
                        bottomSheetItem.supply_price,
                        (parseInt(sheetValues.discount_rate) || 0) / 100
                      ) * (parseInt(sheetValues.quantity) || 0)
                    )}원
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => setBottomSheetItem(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #ddd',
                    background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={saveBottomSheet}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                    background: '#8B1538', color: 'white', fontSize: 15,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── 공유 스타일 ──
const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderBottom: '2px solid #AED6F1',
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
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
  borderRadius: 8,
  border: '1px solid #ddd',
  boxSizing: 'border-box',
};
