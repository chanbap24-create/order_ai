'use client';

import { useState, useEffect } from 'react';

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
  gig_warehouse?: number;
  gig_marketing?: number;
  gig_sales1?: number;
  vintage: string;
  alcohol_content: string;
  country: string;
}

type WarehouseTab = 'CDV' | 'DL';

type ColumnKey =
  | 'item_no'
  | 'item_name'
  | 'brand'
  | 'importer'
  | 'volume_ml'
  | 'barcode'
  | 'supply_price'
  | 'discount_price'
  | 'wholesale_price'
  | 'retail_price'
  | 'min_price'
  | 'total_stock'
  | 'stock_excl_available'
  | 'pending_shipment'
  | 'available_stock'
  | 'bonded_warehouse'
  | 'anseong_warehouse'
  | 'incoming_stock'
  | 'sales_30days'
  | 'avg_sales_90d'
  | 'avg_sales_365d'
  | 'yongma_logistics'
  | 'gig_warehouse'
  | 'gig_marketing'
  | 'gig_sales1'
  | 'vintage'
  | 'alcohol_content'
  | 'country';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  cdvOnly?: boolean;
  dlOnly?: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'item_no', label: '품번' },
  { key: 'item_name', label: '품명' },
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
  { key: 'total_stock', label: '재고수량(B)' },
  { key: 'stock_excl_available', label: '가용재고제외' },
  { key: 'pending_shipment', label: '출고예정' },
  { key: 'available_stock', label: '가용재고', cdvOnly: true },
  { key: 'available_stock', label: '가용재고', dlOnly: true },
  { key: 'bonded_warehouse', label: '보세창고', cdvOnly: true },
  { key: 'yongma_logistics', label: '용마로지스', cdvOnly: true },
  { key: 'anseong_warehouse', label: '안성창고', dlOnly: true },
  { key: 'gig_warehouse', label: 'GIG', dlOnly: true },
  { key: 'gig_marketing', label: 'GIG마케팅', dlOnly: true },
  { key: 'gig_sales1', label: 'GIG영업1', dlOnly: true },
  { key: 'incoming_stock', label: '미착품' },
  { key: 'sales_30days', label: '30일출고' },
  { key: 'avg_sales_90d', label: '90일평균출고' },
  { key: 'avg_sales_365d', label: '365일평균출고' },
];

const DEFAULT_COLUMNS_CDV: ColumnKey[] = ['item_no', 'item_name', 'supply_price', 'available_stock', 'bonded_warehouse', 'sales_30days'];
const DEFAULT_COLUMNS_DL: ColumnKey[] = ['item_no', 'item_name', 'supply_price', 'available_stock', 'anseong_warehouse', 'sales_30days'];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('CDV');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [hideNoSupplyPrice, setHideNoSupplyPrice] = useState(true);
  const [hideNoStock, setHideNoStock] = useState(true);
  const [showOnlyBondedStock, setShowOnlyBondedStock] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // 테이스팅 노트 모달
  const [showTastingNote, setShowTastingNote] = useState(false);
  const [tastingNoteUrl, setTastingNoteUrl] = useState('');
  const [originalPdfUrl, setOriginalPdfUrl] = useState('');
  const [tastingNoteLoading, setTastingNoteLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedWineName, setSelectedWineName] = useState('');

  // 테이스팅 노트 존재 여부 캐시
  const [tastingNotesAvailable, setTastingNotesAvailable] = useState<Record<string, boolean>>({});

  // 컬럼 설정 (localStorage)
  const [visibleColumnsCDV, setVisibleColumnsCDV] = useState<ColumnKey[]>(DEFAULT_COLUMNS_CDV);
  const [visibleColumnsDL, setVisibleColumnsDL] = useState<ColumnKey[]>(DEFAULT_COLUMNS_DL);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    try {
      const savedCDV = localStorage.getItem('inventory_columns_cdv');
      const savedDL = localStorage.getItem('inventory_columns_dl');
      if (savedCDV) { try { setVisibleColumnsCDV(JSON.parse(savedCDV)); } catch (e) {} }
      if (savedDL) { try { setVisibleColumnsDL(JSON.parse(savedDL)); } catch (e) {} }
    } catch (e) {}
  }, []);

  const visibleColumns = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
  const setVisibleColumns = activeTab === 'CDV' ? setVisibleColumnsCDV : setVisibleColumnsDL;

  const toggleColumn = (key: ColumnKey) => {
    if (key === 'item_no' || key === 'item_name') return;
    const newColumns = visibleColumns.includes(key)
      ? visibleColumns.filter(k => k !== key)
      : [...visibleColumns, key];
    setVisibleColumns(newColumns);
    try {
      const storageKey = activeTab === 'CDV' ? 'inventory_columns_cdv' : 'inventory_columns_dl';
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
    } catch (e) {}
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('검색어를 입력해주세요.');
      return;
    }
    setIsSearching(true);
    setError('');
    setHasSearched(true);
    try {
      const endpoint = activeTab === 'CDV'
        ? `/api/inventory/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/inventory/dl/search?q=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '검색 중 오류가 발생했습니다.');
      const results = data.results || [];
      setResults(results);
      if (activeTab === 'CDV') {
        results.forEach((item: InventoryItem) => {
          fetch(`/api/tasting-notes?item_no=${item.item_no}`)
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setTastingNotesAvailable(prev => ({ ...prev, [item.item_no]: true }));
              }
            })
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleTastingNoteClick = async (itemNo: string, itemName: string) => {
    setSelectedItemNo(itemNo);
    setSelectedWineName(itemName);
    setTastingNoteLoading(true);
    setShowTastingNote(true);
    try {
      const response = await fetch(`/api/tasting-notes?item_no=${itemNo}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        const proxyUrl = `/api/proxy/pdf?url=${encodeURIComponent(data.pdf_url)}`;
        setTastingNoteUrl(proxyUrl);
        setOriginalPdfUrl(data.pdf_url);
      } else {
        setTastingNoteUrl('');
        alert(data.error || '테이스팅 노트를 찾을 수 없습니다.');
        setShowTastingNote(false);
      }
    } catch (error) {
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
    } catch (error) {
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num == null || isNaN(num)) return '0';
    return num.toLocaleString('ko-KR');
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price == null || isNaN(price)) return '-';
    return price > 0 ? `₩${formatNumber(price)}` : '-';
  };

  const filteredResults = results.filter(item => {
    if (hideNoSupplyPrice && (!item.supply_price || item.supply_price <= 0)) return false;
    if (activeTab === 'CDV' && showOnlyBondedStock) {
      const hasNoAvailableStock = !item.available_stock || item.available_stock <= 0;
      const hasBondedStock = item.bonded_warehouse && item.bonded_warehouse > 0;
      return hasNoAvailableStock && hasBondedStock;
    }
    if (hideNoStock && (!item.available_stock || item.available_stock <= 0)) return false;
    return true;
  });

  const availableColumns = COLUMNS.filter(col => {
    if (activeTab === 'CDV') return !col.dlOnly;
    if (activeTab === 'DL') return !col.cdvOnly;
    return true;
  });

  const renderCellValue = (item: InventoryItem, key: ColumnKey) => {
    switch (key) {
      case 'item_no': return item.item_no;
      case 'item_name': return item.item_name;
      case 'brand': case 'importer': case 'volume_ml': case 'barcode':
        return item[key] || '-';
      case 'supply_price': case 'discount_price': case 'wholesale_price':
      case 'retail_price': case 'min_price':
        return formatPrice(item[key]);
      case 'available_stock':
        return (
          <span style={{
            color: (item.available_stock ?? 0) > 0 ? '#10b981' : '#ef4444',
            fontWeight: 700
          }}>
            {formatNumber(item.available_stock ?? 0)}
          </span>
        );
      case 'total_stock': case 'stock_excl_available': case 'pending_shipment':
      case 'bonded_warehouse': case 'yongma_logistics': case 'anseong_warehouse':
      case 'gig_warehouse': case 'gig_marketing': case 'gig_sales1':
      case 'incoming_stock': case 'sales_30days': case 'avg_sales_90d':
      case 'avg_sales_365d':
        return formatNumber(item[key] ?? 0);
      case 'vintage': return item.vintage || '-';
      case 'alcohol_content': return item.alcohol_content || '-';
      case 'country': return item.country || '-';
      default: return '-';
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fafaf8',
      wordBreak: 'keep-all' as const,
    }}>
      <style>{`
        .inv-card {
          transition: all 0.2s ease;
          position: relative;
        }
        .inv-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
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
        @media (max-width: 480px) {
          .inv-col-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 24px', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        {/* Header: Title + Tabs + Settings */}
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
            Inventory
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* CDV / DL mini toggle */}
            <div style={{
              display: 'flex',
              background: '#F0EFED',
              borderRadius: 8,
              padding: 2,
            }}>
              {(['CDV', 'DL'] as WarehouseTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setResults([]);
                    setHasSearched(false);
                    setSearchQuery('');
                  }}
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

            {/* Settings gear button */}
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: showColumnSettings ? 'rgba(90,21,21,0.08)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                color: showColumnSettings ? '#5A1515' : '#999',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div style={{
            marginBottom: 12,
            padding: '14px 16px',
            background: 'white',
            borderRadius: 12,
            border: '1px solid #F0EFED',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D' }}>
                표시 컬럼
              </span>
              <span style={{ fontSize: '0.68rem', color: '#999' }}>
                품번·품명은 항상 표시
              </span>
            </div>
            <div className="inv-col-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
            }}>
              {availableColumns
                .filter(col => col.key !== 'item_no' && col.key !== 'item_name')
                .map(col => {
                  const isActive = visibleColumns.includes(col.key);
                  return (
                    <button
                      key={`${col.key}-${col.label}`}
                      className={`inv-col-chip${isActive ? ' active' : ''}`}
                      onClick={() => toggleColumn(col.key)}
                    >
                      {col.label}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={searchFocused ? '#5A1515' : '#BCBCBC'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              transition: 'stroke 0.2s ease',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search wine or item code..."
            disabled={isSearching}
            style={{
              width: '100%',
              height: 48,
              paddingLeft: 42,
              paddingRight: 52,
              border: `1.5px solid ${searchFocused ? '#5A1515' : '#E5E5E5'}`,
              borderRadius: 12,
              fontSize: 16,
              background: 'white',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: searchFocused ? '0 0 0 3px rgba(90,21,21,0.06)' : '0 1px 2px rgba(0,0,0,0.04)',
              color: '#1a1a2e',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#F0EFED',
              color: '#5A1515',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              opacity: isSearching ? 0.6 : 1,
            }}
          >
            {isSearching ? '검색중' : '검색'}
          </button>
          <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
        </div>

        {error && (
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        {/* Filter Chips - always visible */}
        <div style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: hasSearched ? '#2D2D2D' : '#BCBCBC',
            minWidth: 60,
          }}>
            {hasSearched
              ? `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''}`
              : 'No search'}
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

        {/* Results */}
        {hasSearched && (
          <div>
            {filteredResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredResults.map((item, index) => {
                  return (
                    <div key={`${item.item_no}-${index}`} className="inv-card" style={{
                      padding: '12px 14px 12px 16px',
                      background: 'white',
                      borderRadius: 10,
                      border: '1px solid #F0EFED',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      cursor: 'default',
                    }}>
                      {/* Row 1: Item code + name */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        marginBottom: 8,
                      }}>
                        {activeTab === 'CDV' ? (
                          <button
                            onClick={() => handleTastingNoteClick(item.item_no, item.item_name)}
                            style={{
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: tastingNotesAvailable[item.item_no] ? '#10b981' : '#BCBCBC',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: tastingNotesAvailable[item.item_no] ? 'underline' : 'none',
                              flexShrink: 0,
                            }}
                          >
                            {item.item_no}
                          </button>
                        ) : (
                          <span style={{
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: '#BCBCBC',
                            flexShrink: 0,
                          }}>
                            {item.item_no}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: '#1a1a2e',
                          lineHeight: 1.3,
                        }}>
                          {item.item_name}
                        </span>
                      </div>

                      {/* Row 2: Values as inline tags */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}>
                        {visibleColumns
                          .filter(colKey => colKey !== 'item_no' && colKey !== 'item_name' && colKey !== 'available_stock')
                          .map(colKey => {
                            const col = availableColumns.find(c => c.key === colKey);
                            if (!col) return null;
                            return (
                              <span key={`${item.item_no}-${colKey}`} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#F7F6F4',
                                fontSize: '0.72rem',
                                lineHeight: 1,
                              }}>
                                <span style={{ color: '#999', fontWeight: 500 }}>{col.label}</span>
                                <span style={{ color: '#2D2D2D', fontWeight: 600 }}>
                                  {renderCellValue(item, colKey)}
                                </span>
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: 'white',
                borderRadius: 12,
                border: '1px solid #F0EFED',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D0D0D0" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2D2D2D' }}>
                  No results found
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
                  {results.length === 0 ? 'Try a different search term' : 'Adjust filters to see more items'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Initial State - intentionally empty */}

        {/* 테이스팅 노트 모달 */}
        {showTastingNote && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowTastingNote(false)}
          >
            <div style={{
              background: 'white',
              borderRadius: 12,
              width: '95vw',
              maxWidth: '1400px',
              height: '95vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(240,236,230,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1a1a2e',
                color: '#f0ece6',
              }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    테이스팅 노트
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'rgba(240,236,230,0.6)' }}>
                    {selectedItemNo} - {selectedWineName}
                  </div>
                </div>
                <button
                  onClick={() => setShowTastingNote(false)}
                  style={{
                    background: 'rgba(240,236,230,0.1)',
                    border: 'none',
                    color: '#f0ece6',
                    fontSize: 20,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {tastingNoteLoading ? (
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⏳</div>
                    <div>테이스팅 노트를 불러오는 중...</div>
                  </div>
                ) : tastingNoteUrl ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      marginBottom: 12,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                    }}>
                      <button
                        className="ds-btn ds-btn-primary ds-btn-sm"
                        onClick={() => handleDownload(originalPdfUrl, `${selectedItemNo}.pdf`)}
                      >
                        PDF
                      </button>
                      <button
                        className="ds-btn ds-btn-sm"
                        onClick={() => handleDownload(originalPdfUrl.replace('.pdf', '.pptx'), `${selectedItemNo}.pptx`)}
                        style={{ background: '#1a1a2e', color: 'white', border: 'none' }}
                      >
                        PPTX
                      </button>
                    </div>
                    <div style={{
                      flex: 1,
                      background: '#f5f5f5',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #E5E5E5',
                      position: 'relative'
                    }}>
                      <iframe
                        src={`${tastingNoteUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                        title="테이스팅 노트 PDF"
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>❌</div>
                    <div>테이스팅 노트를 찾을 수 없습니다.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
