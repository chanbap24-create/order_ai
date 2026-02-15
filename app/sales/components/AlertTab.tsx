'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ClientDetail {
  client_code: string;
  client_name: string;
  total_qty: number;
  last_date: string;
}

interface AlertItem {
  item_no: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock';
  current_stock: number;
  threshold: number;
  country: string;
  supply_price: number;
  avg_sales_90d: number;
  days_remaining: number | null;
  clients: ClientDetail[];
  total_shipped: number;
}

interface Alternative {
  item_no: string;
  item_name: string;
  country: string;
  region: string;
  grape: string;
  wine_type: string;
  price: number;
  stock: number;
  match_level: number;
  match_label: string;
  match_reasons: string[];
}

interface AlertsResponse {
  alerts: AlertItem[];
  total: number;
  out_of_stock_count: number;
  low_stock_count: number;
  scanned_at: string;
}

interface AlertTabProps {
  currentManager: string;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#2e7d32',
  2: '#388e3c',
  3: '#1976d2',
  4: '#1565c0',
  5: '#e65100',
  6: '#bf360c',
};

function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만';
  return n.toLocaleString();
}

type FilterType = 'all' | 'low_stock' | 'out_of_stock';

export default function AlertTab({ currentManager, isAdmin, onCountChange }: AlertTabProps) {
  // 담당자
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState(isAdmin ? '' : currentManager);

  // 알림 데이터
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [counts, setCounts] = useState({ total: 0, low: 0, out: 0 });

  // dismiss 체크
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 펼침
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // 대체 추천
  const [altItemNo, setAltItemNo] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [altSelected, setAltSelected] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null);

  // ── 담당자 목록 로드 — admin만 ──
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/sales/clients/managers');
        const data = await res.json();
        setManagers(data.managers || []);
      } catch { /* ignore */ }
    })();
  }, [isAdmin]);

  // ── 스캔 ──
  const handleScan = useCallback(async () => {
    if (!selectedManager) return;
    setScanning(true);
    setChecked(new Set());
    setAltItemNo(null);
    setExpandedItem(null);

    try {
      const res = await fetch('/api/sales/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager: selectedManager }),
      });
      const data: AlertsResponse = await res.json();
      setAlerts(data.alerts || []);
      setCounts({ total: data.total, low: data.low_stock_count, out: data.out_of_stock_count });
      if (data.scanned_at) setLastScanned(data.scanned_at);
      onCountChange?.(data.total);
    } catch { /* ignore */ }
    finally { setScanning(false); }
  }, [selectedManager, onCountChange]);

  // ── 담당자 변경 시 자동 스캔 ──
  const prevManager = useRef('');
  useEffect(() => {
    if (selectedManager && selectedManager !== prevManager.current) {
      prevManager.current = selectedManager;
      handleScan();
    }
  }, [selectedManager, handleScan]);

  // ── 필터링 ──
  const filtered = alerts.filter(a => {
    if (filter === 'all') return true;
    return a.alert_type === filter;
  });

  // ── 체크 토글 ──
  const toggleCheck = (itemNo: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };

  // ── 전체 선택/해제 ──
  const allChecked = filtered.length > 0 && filtered.every(a => checked.has(a.item_no));
  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(filtered.map(a => a.item_no)));
    }
  };

  // ── dismiss (체크된 품목 제외 처리) ──
  const handleDismiss = async () => {
    if (checked.size === 0) return;
    const itemNos = Array.from(checked);
    try {
      await fetch('/api/sales/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_nos: itemNos, action: 'dismiss' }),
      });
      // 로컬에서 제거
      setAlerts(prev => prev.filter(a => !checked.has(a.item_no)));
      const newTotal = alerts.length - checked.size;
      setCounts(prev => ({
        total: newTotal,
        low: prev.low - alerts.filter(a => checked.has(a.item_no) && a.alert_type === 'low_stock').length,
        out: prev.out - alerts.filter(a => checked.has(a.item_no) && a.alert_type === 'out_of_stock').length,
      }));
      onCountChange?.(newTotal);
      setChecked(new Set());
    } catch { /* ignore */ }
  };

  // ── 대체 추천 ──
  const openAlternatives = async (itemNo: string) => {
    if (altItemNo === itemNo) {
      setAltItemNo(null);
      return;
    }
    setAltItemNo(itemNo);
    setAlternatives([]);
    setAltSelected(new Set());
    setQuoteMsg(null);
    setAltLoading(true);

    try {
      const res = await fetch(`/api/sales/alerts/alternatives?item_no=${encodeURIComponent(itemNo)}`);
      const data = await res.json();
      setAlternatives(data.alternatives || []);
    } catch { /* ignore */ }
    finally { setAltLoading(false); }
  };

  // ── 견적서 추가 ──
  const addToQuote = async () => {
    if (altSelected.size === 0) return;
    setQuoteLoading(true);
    setQuoteMsg(null);

    const items = alternatives
      .filter(a => altSelected.has(a.item_no))
      .map(a => ({ item_no: a.item_no, item_name: a.item_name, price: a.price, country: a.country }));

    try {
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setQuoteMsg(`${data.added_count}개 와인이 견적서에 추가되었습니다.`);
        setAltSelected(new Set());
      } else {
        setQuoteMsg('견적서 추가 중 오류가 발생했습니다.');
      }
    } catch {
      setQuoteMsg('견적서 추가 중 오류가 발생했습니다.');
    } finally {
      setQuoteLoading(false);
    }
  };

  return (
    <div>
      {/* ── 담당자 선택 + 스캔 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {isAdmin ? (
          <select
            value={selectedManager}
            onChange={e => setSelectedManager(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd',
              fontSize: 16, background: 'white', color: '#333',
              flex: '1 1 auto', minWidth: 120, maxWidth: 200,
            }}
          >
            <option value="">담당자 선택</option>
            {managers.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{currentManager}</span>
        )}

        <button
          onClick={handleScan}
          disabled={!selectedManager || scanning}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: !selectedManager || scanning ? '#ccc' : '#5A1515', color: 'white',
            fontSize: 13, fontWeight: 600, cursor: !selectedManager || scanning ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={scanning ? { animation: 'spin 1s linear infinite' } : {}}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          {scanning ? '스캔 중...' : '재고 스캔'}
        </button>

        {lastScanned && (
          <span style={{ fontSize: 11, color: '#999' }}>
            {new Date(lastScanned).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* 담당자 미선택 */}
      {!selectedManager && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#999', fontSize: 13 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
          </svg>
          <div>담당자를 선택하면 해당 거래처의 재고 부족 와인을 확인합니다.</div>
        </div>
      )}

      {/* 결과 있을 때 */}
      {selectedManager && alerts.length > 0 && (
        <>
          {/* ── 요약 + 필터 + 전체선택 ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8, marginBottom: 12,
          }}>
            {/* 카운트 */}
            <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
              {counts.out > 0 && <span style={{ color: '#dc3545', fontWeight: 600 }}>품절 {counts.out}</span>}
              {counts.low > 0 && <span style={{ color: '#e65100', fontWeight: 600 }}>부족 {counts.low}</span>}
              <span style={{ color: '#666' }}>총 {counts.total}건</span>
            </div>

            {/* 필터 */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                { key: 'all' as FilterType, label: '전체' },
                { key: 'out_of_stock' as FilterType, label: '품절' },
                { key: 'low_stock' as FilterType, label: '부족' },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: filter === f.key ? '#5A1515' : '#f0f0f0',
                    color: filter === f.key ? 'white' : '#666',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 전체선택 + dismiss */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, padding: '8px 12px', background: '#f8f8f6', borderRadius: 8,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                style={{ width: 16, height: 16, accentColor: '#5A1515' }}
              />
              <span style={{ fontWeight: 500, color: '#333' }}>
                전체 선택 {checked.size > 0 && `(${checked.size}개)`}
              </span>
            </label>

            {checked.size > 0 && (
              <button
                onClick={handleDismiss}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #dc3545',
                  background: 'white', color: '#dc3545',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                {checked.size}개 제외
              </button>
            )}
          </div>

          {/* ── 알림 카드 리스트 ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(alert => {
              const isExpanded = expandedItem === alert.item_no;
              const isAltOpen = altItemNo === alert.item_no;
              const isChecked = checked.has(alert.item_no);

              return (
                <div key={alert.item_no} style={{
                  background: 'white', borderRadius: 12,
                  border: isChecked
                    ? '2px solid #5A1515'
                    : alert.alert_type === 'out_of_stock' ? '1px solid #ffcdd2' : '1px solid #ffe0b2',
                  overflow: 'hidden',
                  opacity: isChecked ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ padding: '12px 14px' }}>
                    {/* 상단: 체크 + 뱃지 + 소진일 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(alert.item_no)}
                        style={{ width: 16, height: 16, accentColor: '#5A1515', flexShrink: 0 }}
                      />
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: alert.alert_type === 'out_of_stock' ? '#dc3545' : '#ff9800',
                        color: 'white',
                      }}>
                        {alert.alert_type === 'out_of_stock' ? '품절' : '재고 부족'}
                      </span>
                      {alert.days_remaining != null && alert.days_remaining > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: alert.days_remaining <= 7 ? '#dc3545' : alert.days_remaining <= 14 ? '#e65100' : '#ff9800',
                        }}>
                          약 {alert.days_remaining}일 후 소진
                        </span>
                      )}
                    </div>

                    {/* 와인 정보 */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.4 }}>
                        {alert.item_name || alert.item_no}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
                        <span>{alert.item_no}</span>
                        {alert.country && <span>{alert.country}</span>}
                        {alert.supply_price > 0 && <span>{fmt(alert.supply_price)}원</span>}
                      </div>
                    </div>

                    {/* 재고 바 */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#666' }}>
                          재고 <span style={{ fontWeight: 700, color: alert.current_stock <= 0 ? '#dc3545' : '#e65100' }}>{alert.current_stock}</span>병
                        </span>
                        <span style={{ color: '#999', fontSize: 11 }}>기준 {alert.threshold}병</span>
                      </div>
                      <div style={{ height: 5, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min((alert.current_stock / Math.max(alert.threshold, 1)) * 100, 100)}%`,
                          background: alert.current_stock <= 0 ? '#dc3545' : alert.current_stock < alert.threshold * 0.3 ? '#ff5722' : '#ff9800',
                        }} />
                      </div>
                    </div>

                    {/* 거래처 + 대체추천 버튼 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => setExpandedItem(isExpanded ? null : alert.item_no)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, color: '#5A1515', fontWeight: 500,
                          display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                        </svg>
                        거래처 {alert.clients.length}곳 · {alert.total_shipped}병 출고
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      <button
                        onClick={() => openAlternatives(alert.item_no)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none',
                          background: isAltOpen ? '#f5f5f5' : '#5A1515', color: isAltOpen ? '#666' : 'white',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        {isAltOpen ? '닫기' : '대체 추천'}
                      </button>
                    </div>
                  </div>

                  {/* ── 거래처 펼침: 거래처명 + 수량 + 최근구매 ── */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f0f0f0', background: '#fafaf8' }}>
                      {/* 헤더 */}
                      <div style={{
                        display: 'flex', padding: '8px 14px',
                        fontSize: 11, color: '#999', fontWeight: 600, borderBottom: '1px solid #f0f0f0',
                      }}>
                        <span style={{ flex: 1 }}>거래처명</span>
                        <span style={{ width: 60, textAlign: 'right' }}>수량</span>
                        <span style={{ width: 90, textAlign: 'right' }}>최근 출고</span>
                      </div>
                      {alert.clients.map(c => (
                        <div key={c.client_code} style={{
                          display: 'flex', alignItems: 'center', padding: '7px 14px',
                          fontSize: 12, borderBottom: '1px solid #f8f8f8',
                        }}>
                          <span style={{ flex: 1, fontWeight: 500, color: '#333' }}>{c.client_name}</span>
                          <span style={{ width: 60, textAlign: 'right', fontWeight: 600, color: '#5A1515' }}>
                            {c.total_qty}병
                          </span>
                          <span style={{ width: 90, textAlign: 'right', color: '#999', fontSize: 11 }}>
                            {c.last_date || '-'}
                          </span>
                        </div>
                      ))}
                      {alert.clients.length === 0 && (
                        <div style={{ padding: '12px 14px', fontSize: 12, color: '#999' }}>
                          출고 기록이 없습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 대체 추천 패널 ── */}
                  {isAltOpen && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '14px', background: '#f9f6f2' }}>
                      {altLoading ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#999' }}>
                          대체 와인을 찾는 중...
                        </div>
                      ) : alternatives.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#999' }}>
                          유사한 대체 와인을 찾을 수 없습니다.
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#5A1515', marginBottom: 10 }}>
                            대체 추천 ({alternatives.length}개)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {alternatives.map(alt => {
                              const isAltChecked = altSelected.has(alt.item_no);
                              return (
                                <div key={alt.item_no}
                                  onClick={() => {
                                    setAltSelected(prev => {
                                      const next = new Set(prev);
                                      if (next.has(alt.item_no)) next.delete(alt.item_no);
                                      else next.add(alt.item_no);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    background: 'white', borderRadius: 8, padding: '10px 12px',
                                    border: isAltChecked ? '2px solid #5A1515' : '1px solid #e8e8e8',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>
                                        {alt.item_name || alt.item_no}
                                      </div>
                                      <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 11, color: '#888' }}>
                                        <span>{alt.item_no}</span>
                                        {alt.country && <span>{alt.country}</span>}
                                        {alt.region && <span>{alt.region}</span>}
                                      </div>
                                      {/* match label + reasons */}
                                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                        <span style={{
                                          fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                          background: LEVEL_COLORS[alt.match_level] || '#666',
                                          color: 'white', fontWeight: 600,
                                        }}>
                                          {alt.match_label}
                                        </span>
                                        {alt.match_reasons
                                          .filter(r => !alt.match_label.includes(r.replace('같은 ', '')))
                                          .map((reason, i) => (
                                            <span key={i} style={{
                                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                              background: '#fef3e2', color: '#e65100', fontWeight: 500,
                                            }}>
                                              {reason}
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                                        {fmt(alt.price)}원
                                      </div>
                                      <div style={{ fontSize: 11, color: '#4CAF50', marginTop: 2 }}>
                                        재고 {alt.stock}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* 견적서 추가 */}
                          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={addToQuote}
                              disabled={altSelected.size === 0 || quoteLoading}
                              style={{
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: altSelected.size === 0 ? '#ddd' : '#5A1515',
                                color: 'white', fontSize: 12, fontWeight: 600,
                                cursor: altSelected.size === 0 ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" />
                                <line x1="9" y1="15" x2="15" y2="15" />
                              </svg>
                              {quoteLoading ? '추가 중...' : `견적서에 추가 (${altSelected.size})`}
                            </button>
                            {quoteMsg && (
                              <span style={{ fontSize: 12, color: quoteMsg.includes('오류') ? '#dc3545' : '#4CAF50', fontWeight: 500 }}>
                                {quoteMsg}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 스캔 후 결과 없음 */}
      {selectedManager && !scanning && lastScanned && alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 13 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>재고 부족 품목이 없습니다.</div>
        </div>
      )}

      {/* 스캔 중 */}
      {scanning && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: 13 }}>
          재고를 스캔하는 중...
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
