'use client';

import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

interface InventoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
  bonded_warehouse?: number; // CDV only
  anseong_warehouse?: number; // DL only
  sales_30days: number;
}

type WarehouseTab = 'CDV' | 'DL';

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

  // 필터링된 결과
  const filteredResults = results.filter(item => {
    // 공급가 필터
    if (hideNoSupplyPrice && (!item.supply_price || item.supply_price <= 0)) {
      return false;
    }
    
    // CDV 탭: 보세재고만 있는 품목 보기
    if (activeTab === 'CDV' && showOnlyBondedStock) {
      const hasNoAvailableStock = !item.available_stock || item.available_stock <= 0;
      const hasBondedStock = item.bonded_warehouse && item.bonded_warehouse > 0;
      return hasNoAvailableStock && hasBondedStock;
    }
    
    // 가용재고/재고 없는 품목 숨기기
    if (hideNoStock && (!item.available_stock || item.available_stock <= 0)) {
      return false;
    }
    
    return true;
  });

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
          marginBottom: 'var(--space-8)'
        }}>
          <h1 className="heading-xl" style={{
            marginBottom: 'var(--space-3)',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #FF6B35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2.5rem',
            fontWeight: 800
          }}>
            재고 확인
          </h1>
        </div>

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
                placeholder="품목명을 입력하세요 (예: 샤블리, 까브, 케이스)"
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
              
              {/* 공급가 없는 품목 숨기기 */}
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

              {/* 가용재고 없는 품목 숨기기 */}
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
                가용재고 없는 품목 숨기기
              </label>

              {/* 보세재고만 있는 품목 보기 (CDV only) */}
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
                  gap: 'var(--space-4)'
                }}>
                  {filteredResults.map((item, index) => (
                    <Card key={`${item.item_no}-${index}`} hover>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-4)'
                      }}>
                        {/* 첫 번째 줄: 품목번호 + 품목명 */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: 'var(--space-6)',
                          alignItems: 'center'
                        }}>
                          {/* 품목번호 */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              품목번호
                            </div>
                            <div style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              color: 'var(--color-primary)'
                            }}>
                              {item.item_no}
                            </div>
                          </div>

                          {/* 품목명 */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              품목명
                            </div>
                            <div style={{
                              fontSize: 'var(--text-base)',
                              fontWeight: 600,
                              color: 'var(--color-text)'
                            }}>
                              {item.item_name}
                            </div>
                          </div>
                        </div>

                        {/* 두 번째 줄: 나머지 4개 필드 */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 'var(--space-4)',
                          paddingTop: 'var(--space-3)',
                          borderTop: '1px solid var(--color-border)'
                        }}>
                          {/* 공급가 */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              공급가
                            </div>
                            <div style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 600,
                              color: 'var(--color-text)'
                            }}>
                              {item.supply_price > 0 ? `₩${formatNumber(item.supply_price)}` : '-'}
                            </div>
                          </div>

                          {/* 가용재고/재고 */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              {activeTab === 'CDV' ? '가용재고' : '재고'}
                            </div>
                            <div style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 700,
                              color: item.available_stock > 0 ? '#10b981' : '#ef4444'
                            }}>
                              {formatNumber(item.available_stock)}
                            </div>
                          </div>

                          {/* 보세창고(CDV) / 안성창고(DL) */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              {activeTab === 'CDV' ? '보세창고' : '안성창고'}
                            </div>
                            <div style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 600,
                              color: 'var(--color-text)'
                            }}>
                              {formatNumber(
                                activeTab === 'CDV' 
                                  ? (item.bonded_warehouse || 0)
                                  : (item.anseong_warehouse || 0)
                              )}
                            </div>
                          </div>

                          {/* 30일 출고 */}
                          <div>
                            <div style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--color-text-light)',
                              marginBottom: 'var(--space-1)'
                            }}>
                              30일 출고
                            </div>
                            <div style={{
                              fontSize: 'var(--text-sm)',
                              fontWeight: 600,
                              color: 'var(--color-text-light)'
                            }}>
                              {formatNumber(item.sales_30days)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
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

        {/* Initial State - No search performed */}
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
              <div style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.6
              }}>
                품목명의 일부만 입력해도 검색이 가능합니다<br />
                예: "샤블리", "까브", "케이스" 등
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
