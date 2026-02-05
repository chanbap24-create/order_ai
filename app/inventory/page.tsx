'use client';

import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

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

type WarehouseTab = 'CDV' | 'DL';

type ColumnKey = 
  | 'item_no' 
  | 'item_name' 
  | 'supply_price' 
  | 'discount_price' 
  | 'wholesale_price' 
  | 'retail_price' 
  | 'min_price' 
  | 'available_stock' 
  | 'bonded_warehouse' 
  | 'incoming_stock' 
  | 'sales_30days'
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
  { key: 'supply_price', label: '공급가' },
  { key: 'discount_price', label: '할인공급가' },
  { key: 'wholesale_price', label: '도매가' },
  { key: 'retail_price', label: '판매가' },
  { key: 'min_price', label: '최저판매가' },
  { key: 'vintage', label: '빈티지' },
  { key: 'alcohol_content', label: '알콜도수' },
  { key: 'country', label: '국가' },
  { key: 'available_stock', label: '가용재고', cdvOnly: true },
  { key: 'available_stock', label: '재고', dlOnly: true },
  { key: 'bonded_warehouse', label: '보세창고', cdvOnly: true },
  { key: 'incoming_stock', label: '미착품' },
  { key: 'sales_30days', label: '30일출고' },
];

const DEFAULT_COLUMNS_CDV: ColumnKey[] = ['item_no', 'item_name', 'supply_price', 'available_stock', 'bonded_warehouse', 'sales_30days'];
const DEFAULT_COLUMNS_DL: ColumnKey[] = ['item_no', 'item_name', 'supply_price', 'available_stock', 'sales_30days'];

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
    const storageKey = activeTab === 'CDV' ? 'inventory_columns_cdv' : 'inventory_columns_dl';
    localStorage.setItem(storageKey, JSON.stringify(newColumns));
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
      
      // 검색 결과의 각 품목에 대해 테이스팅 노트 존재 여부 확인
      results.forEach(async (item: InventoryItem) => {
        try {
          const response = await fetch(`/api/tasting-notes?item_no=${item.item_no}`);
          const data = await response.json();
          if (data.success) {
            setTastingNotesAvailable(prev => ({ ...prev, [item.item_no]: true }));
          }
        } catch (err) {
          // 에러 무시 (테이스팅 노트 없음)
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const formatNumber = (num: number) => {
    return num.toLocaleString('ko-KR');
  };

  const formatPrice = (price: number) => {
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
      case 'supply_price':
      case 'discount_price':
      case 'wholesale_price':
      case 'retail_price':
      case 'min_price':
        return formatPrice(item[key]);
      case 'available_stock':
        return (
          <span style={{ 
            color: item.available_stock > 0 ? '#10b981' : '#ef4444',
            fontWeight: 700
          }}>
            {formatNumber(item.available_stock)}
          </span>
        );
      case 'bonded_warehouse':
        return formatNumber(item.bonded_warehouse || 0);
      case 'incoming_stock':
        return formatNumber(item.incoming_stock);
      case 'sales_30days':
        return formatNumber(item.sales_30days);
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
      minHeight: 'calc(100vh - 70px)',
      padding: 'var(--space-6)',
      background: 'var(--color-background)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)'
        }}>
          <h1 className="heading-xl" style={{
            background: 'linear-gradient(135deg, #1A1A1A 0%, #FF6B35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2rem',
            fontWeight: 800
          }}>
            재고 확인
          </h1>
          
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              border: '2px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              background: showColumnSettings ? 'var(--color-primary)' : 'transparent',
              color: showColumnSettings ? 'white' : 'var(--color-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ⚙️ 컬럼 설정
          </button>
        </div>

        {/* Column Settings */}
        {showColumnSettings && (
          <Card style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              marginBottom: 'var(--space-2)',
              color: 'var(--color-text)'
            }}>
              📊 표시할 컬럼 선택
            </h3>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-light)',
              marginBottom: 'var(--space-4)'
            }}>
              💡 품번과 품명은 항상 표시됩니다
            </p>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 'var(--space-3)'
            }}>
              {availableColumns
                .filter(col => col.key !== 'item_no' && col.key !== 'item_name')
                .map(col => (
                  <label
                    key={`${col.key}-${col.label}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background 0.2s',
                      background: visibleColumns.includes(col.key) ? 'rgba(255, 107, 53, 0.1)' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 107, 53, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = visibleColumns.includes(col.key) ? 'rgba(255, 107, 53, 0.1)' : 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: 'var(--color-primary)'
                      }}
                    />
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text)'
                    }}>
                      {col.label}
                    </span>
                  </label>
                ))}
            </div>
          </Card>
        )}

        {/* Warehouse Tabs */}
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => {
                setActiveTab('CDV');
                setResults([]);
                setHasSearched(false);
                setSearchQuery('');
              }}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                background: activeTab === 'CDV' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'CDV' ? 'white' : 'var(--color-text-light)'
              }}
            >
              CDV (와인)
            </button>
            <button
              onClick={() => {
                setActiveTab('DL');
                setResults([]);
                setHasSearched(false);
                setSearchQuery('');
              }}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                background: activeTab === 'DL' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'DL' ? 'white' : 'var(--color-text-light)'
              }}
            >
              DL (글라스)
            </button>
          </div>
        </Card>

        {/* Search Section */}
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'flex-start'
          }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder=""
                disabled={isSearching}
                style={{
                  width: '100%',
                  padding: 'var(--space-4)',
                  fontSize: 'var(--text-base)',
                  border: '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)',
                  background: 'var(--color-background)'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                padding: 'var(--space-4) var(--space-8)',
                minWidth: '120px'
              }}
            >
              {isSearching ? '검색 중...' : '검색'}
            </Button>
          </div>

          {error && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              fontSize: 'var(--text-sm)'
            }}>
              {error}
            </div>
          )}
        </Card>

        {/* Filter Checkboxes */}
        {hasSearched && results.length > 0 && (
          <Card style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{
              display: 'flex',
              gap: 'var(--space-6)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-text)'
              }}>
                필터:
              </div>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)'
              }}>
                <input
                  type="checkbox"
                  checked={hideNoSupplyPrice}
                  onChange={(e) => setHideNoSupplyPrice(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: 'var(--color-primary)'
                  }}
                />
                공급가 없는 품목 숨기기
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                opacity: showOnlyBondedStock ? 0.5 : 1,
                pointerEvents: showOnlyBondedStock ? 'none' : 'auto'
              }}>
                <input
                  type="checkbox"
                  checked={hideNoStock}
                  onChange={(e) => setHideNoStock(e.target.checked)}
                  disabled={showOnlyBondedStock}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: showOnlyBondedStock ? 'not-allowed' : 'pointer',
                    accentColor: 'var(--color-primary)'
                  }}
                />
                재고 없는 품목 숨기기
              </label>

              {activeTab === 'CDV' && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                  opacity: hideNoStock ? 0.5 : 1,
                  pointerEvents: hideNoStock ? 'none' : 'auto'
                }}>
                  <input
                    type="checkbox"
                    checked={showOnlyBondedStock}
                    onChange={(e) => setShowOnlyBondedStock(e.target.checked)}
                    disabled={hideNoStock}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: hideNoStock ? 'not-allowed' : 'pointer',
                      accentColor: 'var(--color-primary)'
                    }}
                  />
                  보세재고만 있는 품목 보기
                </label>
              )}
            </div>
          </Card>
        )}

        {/* Results Section */}
        {hasSearched && (
          <div>
            {filteredResults.length > 0 ? (
              <>
                <div style={{
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-text-light)',
                  fontWeight: 600
                }}>
                  검색 결과: {results.length}개 {filteredResults.length < results.length && `(표시: ${filteredResults.length}개)`}
                </div>

                <div style={{
                  display: 'grid',
                  gap: 'var(--space-3)'
                }}>
                  {filteredResults.map((item, index) => {
                    return (
                      <Card key={`${item.item_no}-${index}`} hover style={{ padding: 'var(--space-4)' }}>
                        {/* 첫 줄: 품번 + 품명 (고정, 수평 배치) */}
                        <div style={{
                          display: 'flex',
                          gap: 'var(--space-4)',
                          marginBottom: 'var(--space-3)',
                          paddingBottom: 'var(--space-3)',
                          borderBottom: '1px solid var(--color-border)',
                          flexWrap: 'wrap'
                        }}>
                          {/* 품번 (클릭 가능) */}
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '11px',
                              color: 'var(--color-text-light)'
                            }}>
                              품번
                            </span>
                            {activeTab === 'CDV' ? (
                              <button
                                onClick={() => handleTastingNoteClick(item.item_no, item.item_name)}
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  color: tastingNotesAvailable[item.item_no] ? '#10B981' : '#8B1538',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: 0
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = tastingNotesAvailable[item.item_no] ? '#059669' : '#6B0F2B'}
                                onMouseLeave={(e) => e.currentTarget.style.color = tastingNotesAvailable[item.item_no] ? '#10B981' : '#8B1538'}
                              >
                                {item.item_no}
                              </button>
                            ) : (
                              <span style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                color: 'var(--color-primary)'
                              }}>
                                {item.item_no}
                              </span>
                            )}
                          </div>

                          {/* 품명 */}
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flex: 1 }}>
                            <span style={{
                              fontSize: '11px',
                              color: 'var(--color-text-light)'
                            }}>
                              품명
                            </span>
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--color-text)'
                            }}>
                              {item.item_name}
                            </span>
                          </div>
                        </div>

                        {/* 둘째 줄: 선택한 컬럼들 (품번/품명 제외, 순차 배치) */}
                        <div style={{
                          display: 'flex',
                          gap: 'var(--space-4)',
                          flexWrap: 'wrap'
                        }}>
                          {visibleColumns
                            .filter(colKey => colKey !== 'item_no' && colKey !== 'item_name')
                            .map(colKey => {
                              const col = availableColumns.find(c => c.key === colKey);
                              if (!col) return null;
                              
                              return (
                                <div key={`${item.item_no}-${colKey}`} style={{
                                  display: 'flex',
                                  gap: 'var(--space-2)',
                                  alignItems: 'center'
                                }}>
                                  <span style={{
                                    fontSize: '11px',
                                    color: 'var(--color-text-light)'
                                  }}>
                                    {col.label}
                                  </span>
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-text)'
                                  }}>
                                    {renderCellValue(item, colKey)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <Card>
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-12)',
                  color: 'var(--color-text-light)'
                }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: 'var(--space-4)',
                    opacity: 0.3
                  }}>
                    📦
                  </div>
                  <div style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 600,
                    marginBottom: 'var(--space-2)'
                  }}>
                    {results.length === 0 ? '검색 결과가 없습니다' : '필터 조건에 맞는 품목이 없습니다'}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-sm)'
                  }}>
                    {results.length === 0 ? '다른 검색어로 시도해보세요' : '필터를 해제하거나 다른 검색어를 시도해보세요'}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Initial State */}
        {!hasSearched && (
          <Card>
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-16)',
              color: 'var(--color-text-light)'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: 'var(--space-6)',
                opacity: 0.3
              }}>
                🔍
              </div>
              <div style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                marginBottom: 'var(--space-3)',
                color: 'var(--color-text)'
              }}>
                품목명을 검색하세요
              </div>
            </div>
          </Card>
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
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#8B1538',
                color: 'white'
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                    테이스팅 노트
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', opacity: 0.9 }}>
                    {selectedItemNo} - {selectedWineName}
                  </div>
                </div>
                <button
                  onClick={() => setShowTastingNote(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
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
                        <a
                          href={originalPdfUrl} 
                          download
                          style={{
                            padding: 'var(--space-2) var(--space-4)',
                            background: '#8B1538',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                          }}
                        >
                          📄 PDF
                        </a>
                        {/* PPTX 다운로드 */}
                        <a
                          href={originalPdfUrl.replace('.pdf', '.pptx')} 
                          download
                          style={{
                            padding: 'var(--space-2) var(--space-4)',
                            background: '#FF6B35',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                          }}
                        >
                          📊 PPTX
                        </a>
                      </div>
                    
                    {/* PDF 미리보기 (embed) */}
                    <div style={{
                      flex: 1,
                      background: '#f5f5f5',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)'
                    }}>
                      <embed
                        src={`${tastingNoteUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                        type="application/pdf"
                        width="100%"
                        height="100%"
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
