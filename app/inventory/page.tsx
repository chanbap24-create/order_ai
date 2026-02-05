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
  | 'sales_30days';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  cdvOnly?: boolean;
  dlOnly?: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'item_no', label: '품목번호' },
  { key: 'item_name', label: '품목명' },
  { key: 'supply_price', label: '공급가' },
  { key: 'discount_price', label: '할인공급가' },
  { key: 'wholesale_price', label: '도매가' },
  { key: 'retail_price', label: '판매가' },
  { key: 'min_price', label: '최저판매가' },
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
    // 품목번호와 품목명은 토글 불가 (항상 표시)
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

      setResults(data.results || []);
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
              💡 품목번호와 품목명은 항상 표시됩니다
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
                    // 품목번호와 품목명을 제외한 나머지 컬럼
                    const dataColumns = visibleColumns.filter(k => k !== 'item_no' && k !== 'item_name');
                    
                    return (
                      <Card key={`${item.item_no}-${index}`} hover style={{ padding: 'var(--space-4)' }}>
                        {/* 첫 줄: 품목번호 + 품목명 (고정) */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: 'var(--space-3)',
                          marginBottom: 'var(--space-3)',
                          paddingBottom: 'var(--space-3)',
                          borderBottom: '1px solid var(--color-border)'
                        }}>
                          {/* 품목번호 */}
                          <div>
                            <div style={{
                              fontSize: '10px',
                              color: 'var(--color-text-light)',
                              marginBottom: '2px'
                            }}>
                              품목번호
                            </div>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: 'var(--color-primary)'
                            }}>
                              {item.item_no}
                            </div>
                          </div>

                          {/* 품목명 */}
                          <div>
                            <div style={{
                              fontSize: '10px',
                              color: 'var(--color-text-light)',
                              marginBottom: '2px'
                            }}>
                              품목명
                            </div>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'var(--color-text)',
                              lineHeight: 1.3
                            }}>
                              {item.item_name}
                            </div>
                          </div>
                        </div>

                        {/* 둘째 줄: 선택한 컬럼들 */}
                        {dataColumns.length > 0 && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(dataColumns.length, 3)}, 1fr)`,
                            gap: 'var(--space-3)'
                          }}>
                            {dataColumns.map(colKey => {
                              const col = availableColumns.find(c => c.key === colKey);
                              if (!col) return null;
                              
                              return (
                                <div key={`${item.item_no}-${colKey}`}>
                                  <div style={{
                                    fontSize: '10px',
                                    color: 'var(--color-text-light)',
                                    marginBottom: '2px'
                                  }}>
                                    {col.label}
                                  </div>
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--color-text)'
                                  }}>
                                    {renderCellValue(item, colKey)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
      </div>
    </div>
  );
}
