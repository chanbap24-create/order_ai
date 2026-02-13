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
  const [tastingNoteUrl, setTastingNoteUrl] = useState(''); // 프록시 URL
  const [originalPdfUrl, setOriginalPdfUrl] = useState(''); // 원본 GitHub URL
  const [tastingNoteLoading, setTastingNoteLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedWineName, setSelectedWineName] = useState('');
  
  // 테이스팅 노트 존재 여부 캐시 (item_no -> boolean)
  const [tastingNotesAvailable, setTastingNotesAvailable] = useState<Record<string, boolean>>({});
  
  // 컬럼 설정 (localStorage)
  const [visibleColumnsCDV, setVisibleColumnsCDV] = useState<ColumnKey[]>(DEFAULT_COLUMNS_CDV);
  const [visibleColumnsDL, setVisibleColumnsDL] = useState<ColumnKey[]>(DEFAULT_COLUMNS_DL);

  // localStorage에서 설정 불러오기
  useEffect(() => {
    try {
      const savedCDV = localStorage.getItem('inventory_columns_cdv');
      const savedDL = localStorage.getItem('inventory_columns_dl');

      if (savedCDV) {
        try {
          setVisibleColumnsCDV(JSON.parse(savedCDV));
        } catch (e) {}
      }

      if (savedDL) {
        try {
          setVisibleColumnsDL(JSON.parse(savedDL));
        } catch (e) {}
      }
    } catch (e) {
      // localStorage 접근 불가 환경 (일부 모바일 웹뷰, Private 모드 등)
    }
  }, []);

  const visibleColumns = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
  const setVisibleColumns = activeTab === 'CDV' ? setVisibleColumnsCDV : setVisibleColumnsDL;

  const toggleColumn = (key: ColumnKey) => {
    // 품번과 품명은 토글 불가 (항상 표시)
    if (key === 'item_no' || key === 'item_name') return;
    
    const newColumns = visibleColumns.includes(key)
      ? visibleColumns.filter(k => k !== key)
      : [...visibleColumns, key];
    
    setVisibleColumns(newColumns);
    
    // localStorage에 저장
    try {
      const storageKey = activeTab === 'CDV' ? 'inventory_columns_cdv' : 'inventory_columns_dl';
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
    } catch (e) {
      // localStorage 접근 불가 환경
    }
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

      if (!response.ok) {
        throw new Error(data.error || '검색 중 오류가 발생했습니다.');
      }

      const results = data.results || [];
      setResults(results);
      
      // CDV 탭에서만 테이스팅 노트 존재 여부 확인
      if (activeTab === 'CDV') {
        results.forEach((item: InventoryItem) => {
          fetch(`/api/tasting-notes?item_no=${item.item_no}`)
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setTastingNotesAvailable(prev => ({ ...prev, [item.item_no]: true }));
              }
            })
            .catch(() => {
              // 에러 무시 (테이스팅 노트 없음)
            });
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
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleTastingNoteClick = async (itemNo: string, itemName: string) => {
    setSelectedItemNo(itemNo);
    setSelectedWineName(itemName);
    setTastingNoteLoading(true);
    setShowTastingNote(true);

    try {
      const response = await fetch(`/api/tasting-notes?item_no=${itemNo}`, {
        cache: 'no-store' // 캐시 비활성화
      });
      const data = await response.json();
      
      console.log('📝 Tasting note response:', data);

      if (data.success) {
        // 프록시를 통해 PDF를 로드 (브라우저에서 바로 표시)
        const proxyUrl = `/api/proxy/pdf?url=${encodeURIComponent(data.pdf_url)}`;
        setTastingNoteUrl(proxyUrl);
        setOriginalPdfUrl(data.pdf_url); // 원본 URL 저장 (다운로드용)
        console.log('✅ Original PDF URL:', data.pdf_url);
        console.log('✅ Proxy URL:', proxyUrl);
      } else {
        setTastingNoteUrl('');
        console.error('❌ Error:', data.error);
        alert(data.error || '테이스팅 노트를 찾을 수 없습니다.');
        setShowTastingNote(false);
      }
    } catch (error) {
      console.error('❌ 테이스팅 노트 조회 오류:', error);
      alert('테이스팅 노트를 불러오는 중 오류가 발생했습니다.');
      setShowTastingNote(false);
    } finally {
      setTastingNoteLoading(false);
    }
  };

  // 다운로드 핸들러 (모바일 호환)
  const handleDownload = async (url: string, filename: string) => {
    try {
      const downloadUrl = `/api/proxy/pdf?url=${encodeURIComponent(url)}&download=true`;
      
      // fetch로 파일을 받아서 Blob으로 변환
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      
      // Blob URL 생성
      const blobUrl = window.URL.createObjectURL(blob);
      
      // 임시 a 태그 생성해서 다운로드
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Blob URL 해제
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('다운로드 오류:', error);
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
    if (hideNoSupplyPrice && (!item.supply_price || item.supply_price <= 0)) {
      return false;
    }
    
    if (activeTab === 'CDV' && showOnlyBondedStock) {
      const hasNoAvailableStock = !item.available_stock || item.available_stock <= 0;
      const hasBondedStock = item.bonded_warehouse && item.bonded_warehouse > 0;
      return hasNoAvailableStock && hasBondedStock;
    }
    
    if (hideNoStock && (!item.available_stock || item.available_stock <= 0)) {
      return false;
    }
    
    return true;
  });

  const availableColumns = COLUMNS.filter(col => {
    if (activeTab === 'CDV') return !col.dlOnly;
    if (activeTab === 'DL') return !col.cdvOnly;
    return true;
  });

  const renderCellValue = (item: InventoryItem, key: ColumnKey) => {
    switch (key) {
      case 'item_no':
        return item.item_no;
      case 'item_name':
        return item.item_name;
      case 'brand':
      case 'importer':
      case 'volume_ml':
      case 'barcode':
        return item[key] || '-';
      case 'supply_price':
      case 'discount_price':
      case 'wholesale_price':
      case 'retail_price':
      case 'min_price':
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
      case 'total_stock':
      case 'stock_excl_available':
      case 'pending_shipment':
      case 'bonded_warehouse':
      case 'yongma_logistics':
      case 'anseong_warehouse':
      case 'gig_warehouse':
      case 'gig_marketing':
      case 'gig_sales1':
      case 'incoming_stock':
      case 'sales_30days':
      case 'avg_sales_90d':
      case 'avg_sales_365d':
        return formatNumber(item[key] ?? 0);
      case 'vintage':
        return item.vintage || '-';
      case 'alcohol_content':
        return item.alcohol_content || '-';
      case 'country':
        return item.country || '-';
      default:
        return '-';
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fafaf8',
      wordBreak: 'keep-all' as const,
    }}>
      <style>{`
        .inv-result-card { transition: all 0.25s ease !important; }
        .inv-result-card:hover { box-shadow: 0 4px 12px -4px rgba(90,21,21,0.12) !important; transform: translateY(-1px); }
        .inv-filter-check { accent-color: #5A1515; }
      `}</style>
      <div className="ds-page">
        {/* Header */}
        <div className="ds-page-header" style={{ marginBottom: 8 }}>
          <h1 className="ds-page-title">Inventory</h1>
          <button
            className={`ds-btn ${showColumnSettings ? 'ds-btn-secondary' : 'ds-btn-ghost'}`}
            onClick={() => setShowColumnSettings(!showColumnSettings)}
          >
            Setting
          </button>
        </div>

        {/* Column Settings */}
        {showColumnSettings && (
          <div className="ds-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
            <h3 style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: 4,
              color: '#2D2D2D',
            }}>
              표시할 컬럼 선택
            </h3>
            <p style={{
              fontSize: '0.7rem',
              color: '#8E8E93',
              marginBottom: 12,
            }}>
              품번과 품명은 항상 표시됩니다
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 6,
            }}>
              {availableColumns
                .filter(col => col.key !== 'item_no' && col.key !== 'item_name')
                .map(col => (
                  <label
                    key={`${col.key}-${col.label}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '6px 10px',
                      borderRadius: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="inv-filter-check"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#2D2D2D', fontWeight: 500 }}>
                      {col.label}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        )}

        {/* Warehouse Tabs */}
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="ds-tab-group">
            <button
              className={`ds-tab${activeTab === 'CDV' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('CDV');
                setResults([]);
                setHasSearched(false);
                setSearchQuery('');
              }}
            >
              Wine
            </button>
            <button
              className={`ds-tab${activeTab === 'DL' ? ' active' : ''}`}
              onClick={() => {
                setActiveTab('DL');
                setResults([]);
                setHasSearched(false);
                setSearchQuery('');
              }}
            >
              Riedel
            </button>
          </div>
        </div>

        {/* Search Section */}
        <div style={{ marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="ds-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="품목명을 입력하세요..."
              disabled={isSearching}
            />
          </div>
          <button
            className="ds-btn ds-btn-primary"
            onClick={handleSearch}
            disabled={isSearching}
            style={{
              width: 40,
              minWidth: 40,
              height: 40,
              padding: 0,
              opacity: isSearching ? 0.6 : 1,
              cursor: isSearching ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        {/* Filter Checkboxes */}
        {hasSearched && results.length > 0 && (
          <div style={{
            marginBottom: 12,
            padding: '10px 16px',
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'white',
            borderRadius: 8,
            border: '1px solid rgba(90,21,21,0.06)',
          }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5A1515' }}>
              필터
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', color: '#1a1a2e' }}>
              <input type="checkbox" className="inv-filter-check" checked={hideNoSupplyPrice} onChange={(e) => setHideNoSupplyPrice(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              공급가 없는 품목 숨기기
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', color: '#1a1a2e', opacity: showOnlyBondedStock ? 0.5 : 1, pointerEvents: showOnlyBondedStock ? 'none' : 'auto' }}>
              <input type="checkbox" className="inv-filter-check" checked={hideNoStock} onChange={(e) => setHideNoStock(e.target.checked)} disabled={showOnlyBondedStock} style={{ width: 16, height: 16, cursor: showOnlyBondedStock ? 'not-allowed' : 'pointer' }} />
              재고 없는 품목 숨기기
            </label>

            {activeTab === 'CDV' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', color: '#1a1a2e', opacity: hideNoStock ? 0.5 : 1, pointerEvents: hideNoStock ? 'none' : 'auto' }}>
                <input type="checkbox" className="inv-filter-check" checked={showOnlyBondedStock} onChange={(e) => setShowOnlyBondedStock(e.target.checked)} disabled={hideNoStock} style={{ width: 16, height: 16, cursor: hideNoStock ? 'not-allowed' : 'pointer' }} />
                보세재고만 있는 품목 보기
              </label>
            )}
          </div>
        )}

        {/* Results Section */}
        {hasSearched && (
          <div>
            {filteredResults.length > 0 ? (
              <>
                <div style={{
                  marginBottom: 12,
                  fontSize: '0.78rem',
                  color: '#8E8E93',
                  fontWeight: 500,
                }}>
                  검색 결과: {results.length}개 {filteredResults.length < results.length && `(표시: ${filteredResults.length}개)`}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredResults.map((item, index) => {
                    return (
                      <div key={`${item.item_no}-${index}`} className="ds-card inv-result-card" style={{
                        padding: '14px 18px',
                        cursor: 'default',
                      }}>
                        {/* 첫 줄: 품번 + 품명 */}
                        <div style={{
                          display: 'flex',
                          gap: 14,
                          marginBottom: 10,
                          paddingBottom: 10,
                          borderBottom: '1px solid rgba(90,21,21,0.05)',
                          flexWrap: 'wrap',
                        }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>품번</span>
                            {activeTab === 'CDV' ? (
                              <button
                                onClick={() => handleTastingNoteClick(item.item_no, item.item_name)}
                                style={{
                                  fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace',
                                  color: tastingNotesAvailable[item.item_no] ? '#10b981' : '#5A1515',
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  textDecoration: 'underline', padding: 0,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = tastingNotesAvailable[item.item_no] ? '#059669' : '#3D0E0E'}
                                onMouseLeave={(e) => e.currentTarget.style.color = tastingNotesAvailable[item.item_no] ? '#10b981' : '#5A1515'}
                              >
                                {item.item_no}
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: '#5A1515' }}>
                                {item.item_no}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                            <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>품명</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a2e' }}>
                              {item.item_name}
                            </span>
                          </div>
                        </div>

                        {/* 둘째 줄: 선택한 컬럼들 */}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          {visibleColumns
                            .filter(colKey => colKey !== 'item_no' && colKey !== 'item_name')
                            .map(colKey => {
                              const col = availableColumns.find(c => c.key === colKey);
                              if (!col) return null;
                              return (
                                <div key={`${item.item_no}-${colKey}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>{col.label}</span>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a2e' }}>
                                    {renderCellValue(item, colKey)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="ds-card ds-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#2D2D2D' }}>
                  {results.length === 0 ? '검색 결과가 없습니다' : '필터 조건에 맞는 품목이 없습니다'}
                </div>
                <div className="ds-empty-text">
                  {results.length === 0 ? '다른 검색어로 시도해보세요' : '필터를 해제하거나 다른 검색어를 시도해보세요'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!hasSearched && (
          <div className="ds-card ds-empty" style={{ padding: '60px 24px' }}>
            <svg className="ds-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#2D2D2D' }}>
              품목명을 검색하세요
            </div>
          </div>
        )}

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
            padding: 'var(--space-4)'
          }}
          onClick={() => setShowTastingNote(false)}
          >
            <div style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              width: '95vw',
              maxWidth: '1400px',
              height: '95vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
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

              {/* 모달 컨텐츠 */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {tastingNoteLoading ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-light)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⏳</div>
                    <div>테이스팅 노트를 불러오는 중...</div>
                  </div>
                ) : tastingNoteUrl ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* 다운로드 버튼 */}
                    <div style={{
                      marginBottom: 'var(--space-3)',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 'var(--space-2)'
                    }}>
                        {/* PDF 다운로드 */}
                        <button
                          className="ds-btn ds-btn-primary ds-btn-sm"
                          onClick={() => handleDownload(originalPdfUrl, `${selectedItemNo}.pdf`)}
                        >
                          PDF
                        </button>
                        {/* PPTX 다운로드 */}
                        <button
                          className="ds-btn ds-btn-sm"
                          onClick={() => handleDownload(originalPdfUrl.replace('.pdf', '.pptx'), `${selectedItemNo}.pptx`)}
                          style={{ background: '#1a1a2e', color: 'white', border: 'none' }}
                        >
                          PPTX
                        </button>
                      </div>
                    
                    {/* PDF 미리보기 (iframe - 모바일 호환) */}
                    <div style={{
                      flex: 1,
                      background: '#f5f5f5',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)',
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
                  <div style={{ textAlign: 'center', color: 'var(--color-text-light)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>❌</div>
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
