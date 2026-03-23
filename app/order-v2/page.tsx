'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Client {
  client_code: string;
  client_name: string;
  matched_alias?: string;
}

interface Candidate {
  item_no: string;
  item_name: string;
  confidence: number;
  supply_price: number;
  available_stock: number;
  reasoning: string;
  incoming?: { arrival_date: string; total_btls: number };
}

interface OrderLine {
  query: string;
  quantity: number;
  candidates: Candidate[];
  selectedIdx: number; // 선택된 후보 인덱스 (-1이면 미선택)
}

interface SearchResult {
  item_no: string;
  item_name: string;
  supply_price: number;
  available_stock: number;
}

interface HistoryItem {
  item_no: string;
  item_name: string;
  supply_price: number;
  buy_count: number;
  last_ship_date: string;
}

// 큰 금액 요약용
function fmtShort(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e6) return (n / 1e4).toFixed(0) + '만';
  return n.toLocaleString();
}
// 가격 정확 표시
function fmt(n: number) {
  return n.toLocaleString();
}

// 배송 예정일 계산
function calcDeliveryDate(
  tab: 'CDV' | 'DL',
  holidays: Set<string>,
  fridayChoice?: 'saturday' | 'monday',
): { date: Date; label: string; options?: { sat: Date; mon: Date } } {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utcMs + kstOffset * 60000);

  const hour = kst.getHours();
  const minute = kst.getMinutes();
  const kstTime = hour * 60 + minute;

  const cutoff = tab === 'CDV' ? 16 * 60 + 31 : 16 * 60 + 1;
  const afterCutoff = kstTime >= cutoff;

  const baseDays = afterCutoff ? 2 : 1;
  const baseDate = new Date(kst);
  baseDate.setDate(baseDate.getDate() + baseDays);

  const dayOfWeek = kst.getDay();
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayLabel = (d: Date) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

  const nextBizDay = (d: Date): Date => {
    const result = new Date(d);
    while (true) {
      const dow = result.getDay();
      const ymd = fmtDate(result);
      if (dow !== 0 && dow !== 6 && !holidays.has(ymd)) break;
      result.setDate(result.getDate() + 1);
    }
    return result;
  };

  if (dayOfWeek === 5) {
    if (afterCutoff) {
      const tue = new Date(kst);
      tue.setDate(tue.getDate() + 4);
      const delivery = nextBizDay(tue);
      return { date: delivery, label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${dayLabel(delivery)})` };
    } else {
      const sat = new Date(kst);
      sat.setDate(sat.getDate() + 1);
      const mon = new Date(kst);
      mon.setDate(mon.getDate() + 3);
      const monBiz = nextBizDay(mon);
      if (fridayChoice === 'saturday') {
        return { date: sat, label: `${sat.getMonth() + 1}/${sat.getDate()}(토)` };
      } else if (fridayChoice === 'monday') {
        return { date: monBiz, label: `${monBiz.getMonth() + 1}/${monBiz.getDate()}(${dayLabel(monBiz)})` };
      }
      return { date: sat, label: '', options: { sat, mon: monBiz } };
    }
  }

  if (dayOfWeek === 6 || dayOfWeek === 0) {
    const delivery = nextBizDay(baseDate);
    return { date: delivery, label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${dayLabel(delivery)})` };
  }

  const delivery = nextBizDay(baseDate);
  return { date: delivery, label: `${delivery.getMonth() + 1}/${delivery.getDate()}(${dayLabel(delivery)})` };
}

export default function OrderV2Page() {
  // 거래처
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 발주
  const [orderText, setOrderText] = useState('');
  const [tab, setTab] = useState<'CDV' | 'DL'>('CDV');

  // 결과
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // 수량/가격 편집
  const [editingQty, setEditingQty] = useState<Record<number, string>>({});
  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});
  const [discountRates, setDiscountRates] = useState<Record<number, number>>({});
  const [customDiscountInput, setCustomDiscountInput] = useState<Record<number, string>>({});

  // 수동 검색
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 배송 예정일
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [fridayChoice, setFridayChoice] = useState<'saturday' | 'monday' | undefined>();
  const [customDeliveryDate, setCustomDeliveryDate] = useState(''); // 임의 지정 날짜

  // 배송 특이사항
  const DELIVERY_PRESETS = [
    '입금확인후출고',
    '명세표부탁드립니다.',
    '계산서발행부탁드립니다.',
    '배송 전 연락바랍니다.',
    '부재시 경비실에 맡겨주세요.',
  ];
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // 거래처 구매이력 품번
  const [historySet, setHistorySet] = useState<Set<string>>(new Set());

  // 품목 펼침/접힘
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  // 배송일/특이사항 펼침
  const [showDeliveryDate, setShowDeliveryDate] = useState(false);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState(false);

  // 거래처 입고내역 조회
  const [showHistory, setShowHistory] = useState(false);
  const [showOldHistory, setShowOldHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`/api/sales/holidays?year=${year}`)
      .then(r => r.json())
      .then(json => setHolidays(new Set(Object.keys(json.holidays || {}))))
      .catch(() => {});
  }, []);

  const deliveryInfo = calcDeliveryDate(tab, holidays, fridayChoice);

  // 최종 배송일 라벨 (커스텀 우선)
  const finalDeliveryLabel = (() => {
    if (customDeliveryDate) {
      const d = new Date(customDeliveryDate + 'T00:00:00');
      const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      return `${d.getMonth() + 1}/${d.getDate()}(${dayLabel})`;
    }
    return deliveryInfo.label;
  })();

  // 거래처 검색 (tab에 따라 CDV/DL 테이블)
  const abortRef = useRef<AbortController | null>(null);
  const searchClients = useCallback(async (q: string) => {
    // 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/order-v2/clients?q=${encodeURIComponent(q)}&tab=${tab}`, { signal: controller.signal });
      const json = await res.json();
      if (!controller.signal.aborted) setClientResults(json.clients || []);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setClientResults([]);
    }
  }, [tab]);

  useEffect(() => {
    if (!showDropdown || !clientQuery.trim()) {
      if (!clientQuery.trim()) setClientResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchClients(clientQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [clientQuery, showDropdown, searchClients]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchIdx(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pickClient = (c: Client) => {
    setSelectedClient(c);
    setClientQuery(c.client_name);
    setShowDropdown(false);
    // 거래처 변경 시 입고내역 리셋
    setHistoryItems([]);
    setHistoryLoaded(false);
    setShowHistory(false);
    setShowOldHistory(false);
  };

  // 탭 변경 시 거래처 + 입고내역 리셋
  useEffect(() => {
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    setHistoryItems([]);
    setHistoryLoaded(false);
    setShowHistory(false);
    setShowOldHistory(false);
  }, [tab]);

  // 거래처 입고내역 조회
  const fetchHistory = useCallback(async () => {
    if (!selectedClient?.client_code) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/order-v2/history?client_code=${encodeURIComponent(selectedClient.client_code)}&tab=${tab}`);
      const json = await res.json();
      setHistoryItems(json.items || []);
      setHistoryLoaded(true);
    } catch { setHistoryItems([]); }
    finally { setHistoryLoading(false); }
  }, [selectedClient?.client_code, tab]);

  const toggleHistory = () => {
    if (!showHistory && !historyLoaded) {
      fetchHistory();
    }
    setShowHistory(v => !v);
  };

  // 와인 수동 검색
  const handleWineSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/order-v2/search?q=${encodeURIComponent(q)}&tab=${tab}`);
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, [tab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchIdx !== null) handleWineSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchIdx, handleWineSearch]);

  // 발주 파싱
  const handleParse = async () => {
    if (!orderText.trim()) return;
    setLoading(true);
    setError('');
    setOrderLines([]);
    setUsage(null);
    setDiscountRates({});
    setSearchIdx(null);

    try {
      const res = await fetch('/api/order-v2/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: selectedClient?.client_code || '',
          client_name: selectedClient?.client_name || clientQuery || '',
          order_text: orderText,
          tab,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '파싱 실패'); return; }

      const lines: OrderLine[] = (json.orderLines || []).map((ol: any) => ({
        query: ol.query || '',
        quantity: ol.quantity || 1,
        candidates: ol.candidates || [],
        selectedIdx: ol.candidates?.length > 0 ? 0 : -1, // 첫번째 후보 자동선택
      }));
      setOrderLines(lines);
      setUsage(json.usage || null);
      setHistorySet(new Set((json.historyItemNos || []).map((n: string) => n.trim().toUpperCase())));
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  // 후보 선택
  const selectCandidate = (lineIdx: number, candIdx: number) => {
    setOrderLines(prev => prev.map((ol, i) =>
      i === lineIdx ? { ...ol, selectedIdx: candIdx } : ol
    ));
  };

  // 수동 검색으로 품목 교체
  const replaceWithSearch = (lineIdx: number, wine: SearchResult) => {
    setOrderLines(prev => prev.map((ol, i) => {
      if (i !== lineIdx) return ol;
      const newCand: Candidate = {
        item_no: wine.item_no,
        item_name: wine.item_name,
        confidence: 1,
        supply_price: wine.supply_price || 0,
        available_stock: wine.available_stock || 0,
        reasoning: '수동 검색',
      };
      return {
        ...ol,
        candidates: [newCand, ...ol.candidates],
        selectedIdx: 0,
      };
    }));
    setSearchIdx(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // 항목 삭제
  const removeLine = (idx: number) => {
    setOrderLines(prev => prev.filter((_, i) => i !== idx));
  };

  // 수량 변경
  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setOrderLines(prev => prev.map((ol, i) => i === idx ? { ...ol, quantity: qty } : ol));
  };

  // 공급가 변경
  const updatePrice = (lineIdx: number, price: number) => {
    setOrderLines(prev => prev.map((ol, i) => {
      if (i !== lineIdx) return ol;
      const candIdx = ol.selectedIdx;
      if (candIdx < 0) return ol;
      const newCands = [...ol.candidates];
      newCands[candIdx] = { ...newCands[candIdx], supply_price: price };
      return { ...ol, candidates: newCands };
    }));
  };

  const updateDiscount = (idx: number, rate: number) => {
    setDiscountRates(prev => ({ ...prev, [idx]: rate }));
  };

  // 선택된 품목 가져오기
  const getSelected = (ol: OrderLine): Candidate | null => {
    if (ol.selectedIdx < 0 || ol.selectedIdx >= ol.candidates.length) return null;
    return ol.candidates[ol.selectedIdx];
  };

  const getItemPrice = (idx: number) => {
    const sel = getSelected(orderLines[idx]);
    if (!sel) return 0;
    const rate = discountRates[idx] || 0;
    return Math.round(sel.supply_price * (1 - rate / 100));
  };

  const totalAmount = orderLines.reduce((s, ol, idx) => s + getItemPrice(idx) * ol.quantity, 0);

  // DL 단위: 레스토랑/글라스 시리즈=잔, 디캔터/박스/쇼핑백 등=개, CDV=병
  const getUnit = (itemNo?: string, itemName?: string) => {
    if (tab !== 'DL') return '병';
    const name = itemName || '';
    // 디캔터, 박스, 쇼핑백 등 비글라스 제품은 "개"
    if (/디캔터|박스|쇼핑백|클리너|캐링백|세트|밸류팩|폴리싱|클로스|린넨/i.test(name)) return '개';
    // 레스토랑 시리즈 (이름에 레스토랑/글라스 포함, 또는 RD 코드, 또는 0xxx/xx 형식 품명)
    if (/레스토랑|글라스|glass/i.test(name)) return '잔';
    if (/RD\s+\d{4}\/\d/i.test(name)) return '잔';
    if (/0\d{3}\/\d/.test(name)) return '잔';
    // 품번이 0으로 시작 (레스토랑 시리즈)
    if (itemNo?.trim().startsWith('0')) return '잔';
    return '개';
  };

  // 발주 메시지
  const staffMessage = (() => {
    if (orderLines.length === 0) return '';
    const name = selectedClient?.client_name || clientQuery || '(미지정)';
    const deliveryLine = finalDeliveryLabel ? `배송 예정일: ${finalDeliveryLabel}` : '';
    const lines = orderLines.map((ol, idx) => {
      const sel = getSelected(ol);
      if (!sel) return `- (미선택) / ${ol.query} / ${ol.quantity}${getUnit(undefined, ol.query)}`;
      const rate = discountRates[idx] || 0;
      const price = getItemPrice(idx);
      const hasHistory = historySet.has(sel.item_no.trim().toUpperCase());
      const pricePart = rate === 100
        ? ' / 시음주'
        : rate > 0
        ? ` / ${fmt(price)} (${rate}%↓)`
        : (!hasHistory && sel.supply_price > 0) ? ` / ${fmt(sel.supply_price)}` : '';
      return `- ${sel.item_no} / ${sel.item_name} / ${ol.quantity}${getUnit(sel.item_no, sel.item_name)}${pricePart}`;
    });
    const notesLine = deliveryNotes.trim() ? `\n${deliveryNotes.trim()}\n` : '';
    return `[${name}]\n${deliveryLine ? deliveryLine + '\n' : ''}${notesLine}\n${lines.join('\n')}\n\n발주 요청드립니다.`;
  })();

  const copyMessage = () => {
    navigator.clipboard.writeText(staffMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setSelectedClient(null);
    setClientQuery('');
    setOrderText('');
    setOrderLines([]);
    setError('');
    setUsage(null);
    setDiscountRates({});
    setSearchIdx(null);
    setCustomDeliveryDate('');
    setDeliveryNotes('');
    setFridayChoice(undefined);
    setHistoryItems([]);
    setHistoryLoaded(false);
    setShowHistory(false);
    setShowOldHistory(false);
  };

  const confColor = (c: number) => c >= 0.9 ? '#16a34a' : c >= 0.7 ? '#2563eb' : c >= 0.5 ? '#d97706' : '#dc2626';
  const confLabel = (c: number) => c >= 0.9 ? '확실' : c >= 0.7 ? '높음' : c >= 0.5 ? '중간' : '불확실';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        @keyframes orderPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes orderSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orderShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .order-card:hover { box-shadow: 0 4px 20px rgba(90,21,21,0.06) !important; }
        .order-btn-parse:hover:not(:disabled) {
          box-shadow: 0 6px 24px rgba(90,21,21,0.25) !important;
          transform: translateY(-1px);
        }
        .order-btn-parse:active:not(:disabled) { transform: translateY(0); }
        .order-btn-parse { transition: all 0.2s ease !important; }
        .order-client-item:hover { background: rgba(90,21,21,0.03) !important; }
        .order-cand-btn:hover { background: rgba(90,21,21,0.03) !important; }
        .order-search-item:hover { background: rgba(90,21,21,0.03) !important; }
        .order-copy-btn:hover { border-color: #5A1515 !important; color: #5A1515 !important; }
        .order-preset-btn:hover { background: rgba(255,255,255,0.15) !important; }
        .order-input:focus { border-color: rgba(90,21,21,0.3) !important; box-shadow: 0 0 0 3px rgba(90,21,21,0.06) !important; }
        .order-line-card:hover { border-color: rgba(90,21,21,0.12) !important; }
        .order-qty-btn:hover { background: rgba(90,21,21,0.04) !important; border-color: rgba(90,21,21,0.2) !important; }
        .order-history-row:hover { background: rgba(90,21,21,0.02) !important; }
      `}</style>

      <div style={{
        maxWidth: 760, margin: '0 auto', padding: '64px 20px 48px',
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        minHeight: '100vh',
      }}>

        {/* ═══ Header ═══ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 28, fontWeight: 600, color: '#1a1a2e',
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Order
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#5A1515',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              opacity: 0.6,
            }}>
              AI Parsing
            </span>
          </div>
          <div style={{
            width: 32, height: 2, marginTop: 10,
            background: 'linear-gradient(90deg, #5A1515, rgba(90,21,21,0.15))',
            borderRadius: 1,
          }} />
        </div>

        {/* ═══ Input Card ═══ */}
        <div className="order-card" style={{
          background: '#fff', borderRadius: 14, padding: '22px 22px 20px',
          border: '1px solid rgba(90,21,21,0.06)',
          boxShadow: '0 2px 12px rgba(90,21,21,0.03)',
          marginBottom: 20,
          transition: 'box-shadow 0.3s ease',
        }}>

          {/* CDV / DL toggle */}
          <div style={{
            display: 'inline-flex', gap: 0,
            background: 'rgba(90,21,21,0.04)', borderRadius: 9,
            padding: 3, marginBottom: 18,
          }}>
            {(['CDV', 'DL'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '7px 22px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: 'none',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#5A1515' : '#a8a098',
                cursor: 'pointer',
                boxShadow: tab === t ? '0 1px 4px rgba(90,21,21,0.08)' : 'none',
                transition: 'all 0.2s ease',
                letterSpacing: '0.04em',
              }}>{t}</button>
            ))}
          </div>

          {/* 거래처 */}
          <div style={{ marginBottom: 18, position: 'relative' }} ref={dropdownRef}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: '#a8a098', marginBottom: 7,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>거래처</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={clientQuery}
                className="order-input"
                onChange={e => { setClientQuery(e.target.value); setSelectedClient(null); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="거래처명 또는 코드 검색"
                style={{
                  flex: 1, fontSize: 16, padding: '11px 14px', borderRadius: 10,
                  border: '1px solid rgba(90,21,21,0.1)', background: '#faf9f7', color: '#2c1810',
                  outline: 'none', transition: 'all 0.2s ease',
                  fontFamily: "'DM Sans', -apple-system, sans-serif",
                }}
              />
              {selectedClient && (
                <span style={{
                  fontSize: 11, color: '#16a34a', fontWeight: 600,
                  whiteSpace: 'nowrap', padding: '5px 10px',
                  background: 'rgba(22,163,74,0.06)', borderRadius: 7,
                  border: '1px solid rgba(22,163,74,0.1)',
                }}>
                  {selectedClient.client_code}
                </span>
              )}
            </div>
            {showDropdown && clientResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#fff', borderRadius: 10, marginTop: 4,
                border: '1px solid rgba(90,21,21,0.08)',
                boxShadow: '0 8px 32px rgba(90,21,21,0.1)',
                maxHeight: 240, overflowY: 'auto',
              }}>
                {clientResults.map(c => (
                  <button key={c.client_code} onClick={() => pickClient(c)}
                    className="order-client-item"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      width: '100%', padding: '11px 14px', border: 'none', background: 'transparent',
                      cursor: 'pointer', fontSize: 14, color: '#2c1810', textAlign: 'left',
                      borderBottom: '1px solid rgba(90,21,21,0.04)',
                      transition: 'background 0.15s ease',
                    }}>
                    <span style={{ fontWeight: 600 }}>
                      {c.client_name}
                      {c.matched_alias && (
                        <span style={{ fontWeight: 400, fontSize: 11, color: '#8a8580', marginLeft: 6 }}>
                          ({c.matched_alias})
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: '#a8a098', fontFamily: "'DM Sans', monospace" }}>{c.client_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 거래처 입고내역 (접힘/펼침) */}
          {selectedClient && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={toggleHistory} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}>
                <span style={{
                  fontSize: 8, color: '#a8a098', display: 'inline-block',
                  transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}>▶</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5A1515' }}>
                  입고내역
                </span>
                {historyLoaded && (
                  <span style={{
                    fontSize: 10, color: '#a8a098', fontWeight: 500,
                    padding: '1px 6px', background: 'rgba(90,21,21,0.04)', borderRadius: 4,
                  }}>
                    {historyItems.length}
                  </span>
                )}
              </button>

              {showHistory && (() => {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const cutoff = oneYearAgo.toISOString().slice(0, 10);
                const recentItems = historyItems.filter(h => (h.last_ship_date || '') >= cutoff);
                const oldItems = historyItems.filter(h => (h.last_ship_date || '') < cutoff);

                const renderTable = (items: HistoryItem[]) => (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(90,21,21,0.06)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#a8a098', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>품명</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#a8a098', fontSize: 10, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>공급가</th>
                        {tab === 'CDV' && (
                          <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#a8a098', fontSize: 10, whiteSpace: 'nowrap' }}>횟수</th>
                        )}
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#a8a098', fontSize: 10, whiteSpace: 'nowrap' }}>최근입고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((h, i) => (
                        <tr key={i} className="order-history-row" style={{
                          borderBottom: '1px solid rgba(90,21,21,0.03)',
                          transition: 'background 0.15s ease',
                        }}>
                          <td style={{ padding: '7px 12px', color: '#2c1810' }}>
                            <div style={{ fontWeight: 500, lineHeight: 1.3, fontSize: 12 }}>{h.item_name}</div>
                            <div style={{ fontSize: 10, color: '#b8b0a8', fontFamily: "'DM Sans', monospace" }}>{h.item_no}</div>
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c1810', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {h.supply_price ? fmt(h.supply_price) : '-'}
                          </td>
                          {tab === 'CDV' && (
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#5A1515', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {h.buy_count || '-'}
                            </td>
                          )}
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#b8b0a8', whiteSpace: 'nowrap', fontSize: 11 }}>
                            {h.last_ship_date ? h.last_ship_date.slice(0, 10) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );

                return (
                  <div style={{
                    marginTop: 6, border: '1px solid rgba(90,21,21,0.06)', borderRadius: 10,
                    background: '#faf9f7', overflow: 'hidden',
                    animation: 'orderSlideIn 0.2s ease',
                  }}>
                    {historyLoading ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#a8a098' }}>
                        <span style={{ animation: 'orderPulse 1.2s ease-in-out infinite' }}>불러오는 중...</span>
                      </div>
                    ) : historyItems.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#b8b0a8' }}>
                        입고내역이 없습니다
                      </div>
                    ) : (
                      <>
                        {/* 최근 1년 */}
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                          {recentItems.length > 0 ? renderTable(recentItems) : (
                            <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: '#b8b0a8' }}>
                              최근 1년 내 입고내역 없음
                            </div>
                          )}
                        </div>

                        {/* 1년 이전 */}
                        {oldItems.length > 0 && (
                          <div style={{ borderTop: '1px solid rgba(90,21,21,0.06)' }}>
                            <button onClick={() => setShowOldHistory(v => !v)} style={{
                              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                              padding: '9px 12px', background: 'rgba(90,21,21,0.02)',
                              border: 'none', cursor: 'pointer',
                            }}>
                              <span style={{
                                fontSize: 8, color: '#a8a098', display: 'inline-block',
                                transform: showOldHistory ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                              }}>▶</span>
                              <span style={{ fontSize: 11, color: '#a8a098' }}>
                                1년 이전 ({oldItems.length}건)
                              </span>
                            </button>
                            {showOldHistory && (
                              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                                {renderTable(oldItems)}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 발주 내용 */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: '#a8a098', marginBottom: 7,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>발주 내용</label>
            <textarea value={orderText} onChange={e => setOrderText(e.target.value)}
              className="order-input"
              placeholder="카톡/문자 발주 내용을 붙여넣으세요"
              rows={6}
              style={{
                width: '100%', fontSize: 16, padding: '13px 14px', borderRadius: 10,
                border: '1px solid rgba(90,21,21,0.1)', background: '#faf9f7',
                color: '#2c1810', outline: 'none', resize: 'vertical',
                fontFamily: "'DM Sans', -apple-system, sans-serif", lineHeight: 1.6,
                boxSizing: 'border-box', transition: 'all 0.2s ease',
              }}
            />
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleParse} disabled={loading || !orderText.trim()}
              className="order-btn-parse"
              style={{
                flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                background: loading || !orderText.trim()
                  ? '#d8d3ce'
                  : 'linear-gradient(135deg, #5A1515 0%, #7a2828 50%, #5A1515 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '0.04em',
                boxShadow: loading || !orderText.trim() ? 'none' : '0 4px 16px rgba(90,21,21,0.15)',
                position: 'relative', overflow: 'hidden',
              }}>
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'orderShimmer 0.8s linear infinite',
                    display: 'inline-block',
                  }} />
                  분석 중...
                </span>
              ) : '발주 분석'}
            </button>
            {orderLines.length > 0 && (
              <button onClick={handleReset} style={{
                padding: '13px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1px solid rgba(90,21,21,0.1)', background: '#fff',
                color: '#a8a098', cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>초기화</button>
            )}
          </div>
        </div>

        {/* ═══ Error ═══ */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)',
            color: '#dc2626', fontSize: 13, fontWeight: 500,
            animation: 'orderSlideIn 0.2s ease',
          }}>{error}</div>
        )}

        {/* ═══ Results ═══ */}
        {orderLines.length > 0 && (
          <div style={{ animation: 'orderSlideIn 0.3s ease' }}>

            {/* ─── Summary Header ─── */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1a2e 40%, #3a1520 100%)',
              borderRadius: 14, padding: '18px 20px', color: '#fff', marginBottom: 16,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* subtle grain texture */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.03,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                pointerEvents: 'none',
              }} />
              {/* radial glow */}
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
                background: 'radial-gradient(ellipse at 80% 30%, rgba(90,21,21,0.3) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
                }}>
                  {selectedClient?.client_name || clientQuery || '발주'} 분석 결과
                </div>
                <div style={{
                  fontSize: 12, opacity: 0.55, marginTop: 3,
                  fontWeight: 500, letterSpacing: '0.02em',
                }}>
                  {orderLines.length}개 품목 · {(() => {
                    if (tab !== 'DL') return `${orderLines.reduce((s, ol) => s + ol.quantity, 0)}병`;
                    let glasses = 0, pieces = 0;
                    orderLines.forEach(ol => {
                      const sel = getSelected(ol);
                      const u = getUnit(sel?.item_no, sel?.item_name);
                      if (u === '잔') glasses += ol.quantity; else pieces += ol.quantity;
                    });
                    const parts = [];
                    if (glasses > 0) parts.push(`${glasses}잔`);
                    if (pieces > 0) parts.push(`${pieces}개`);
                    return parts.join(' + ') || '0개';
                  })()}
                  {totalAmount > 0 && ` · ${fmtShort(totalAmount)}`}
                </div>

                {/* 배송 예정일 (접힘/펼침) */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setShowDeliveryDate(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    <span style={{
                      fontSize: 8, color: 'rgba(255,255,255,0.35)', display: 'inline-block',
                      transform: showDeliveryDate ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}>▶</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>배송 예정일</span>
                    {finalDeliveryLabel && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginLeft: 4 }}>{finalDeliveryLabel}</span>
                    )}
                  </button>
                  {showDeliveryDate && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                      {deliveryInfo.options ? (
                        <>
                          <button onClick={() => { setFridayChoice('saturday'); setCustomDeliveryDate(''); }} style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: fridayChoice === 'saturday' && !customDeliveryDate ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
                            background: fridayChoice === 'saturday' && !customDeliveryDate ? 'rgba(255,255,255,0.12)' : 'transparent',
                            color: '#fff', cursor: 'pointer', transition: 'all 0.2s ease',
                          }}>토 {deliveryInfo.options.sat.getMonth() + 1}/{deliveryInfo.options.sat.getDate()}</button>
                          <button onClick={() => { setFridayChoice('monday'); setCustomDeliveryDate(''); }} style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: fridayChoice === 'monday' && !customDeliveryDate ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
                            background: fridayChoice === 'monday' && !customDeliveryDate ? 'rgba(255,255,255,0.12)' : 'transparent',
                            color: '#fff', cursor: 'pointer', transition: 'all 0.2s ease',
                          }}>월 {deliveryInfo.options.mon.getMonth() + 1}/{deliveryInfo.options.mon.getDate()}</button>
                        </>
                      ) : (
                        <button onClick={() => setCustomDeliveryDate('')} style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: !customDeliveryDate ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
                          background: !customDeliveryDate ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: '#fff', cursor: 'pointer', transition: 'all 0.2s ease',
                        }}>{deliveryInfo.label}</button>
                      )}
                      <input type="date" value={customDeliveryDate}
                        onChange={e => setCustomDeliveryDate(e.target.value)}
                        style={{
                          fontSize: 16, padding: '5px 10px', borderRadius: 8,
                          border: customDeliveryDate ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
                          background: customDeliveryDate ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                          color: '#fff', cursor: 'pointer', colorScheme: 'dark',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 배송 특이사항 (접힘/펼침) */}
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setShowDeliveryNotes(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    <span style={{
                      fontSize: 8, color: 'rgba(255,255,255,0.35)', display: 'inline-block',
                      transform: showDeliveryNotes ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}>▶</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>특이사항</span>
                    {deliveryNotes.trim() && (
                      <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
                      }}>
                        {deliveryNotes.trim().split('\n')[0]}
                      </span>
                    )}
                  </button>
                  {showDeliveryNotes && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {DELIVERY_PRESETS.map(preset => {
                          const isActive = deliveryNotes.includes(preset);
                          return (
                            <button key={preset} onClick={() => {
                              if (isActive) {
                                setDeliveryNotes(prev => prev.replace(preset, '').replace(/\n{2,}/g, '\n').trim());
                              } else {
                                setDeliveryNotes(prev => prev ? prev + '\n' + preset : preset);
                              }
                            }}
                              className="order-preset-btn"
                              style={{
                                padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: isActive ? 700 : 500,
                                border: isActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}>{preset}</button>
                          );
                        })}
                      </div>
                      <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                        placeholder="추가 특이사항 입력"
                        rows={2}
                        style={{
                          width: '100%', fontSize: 16, padding: '9px 12px', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
                          color: '#fff', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                          fontFamily: "'DM Sans', -apple-system, sans-serif",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Staff Message ─── */}
            <div className="order-card" style={{
              background: '#fff', borderRadius: 14, padding: '16px 18px',
              border: '1px solid rgba(90,21,21,0.06)',
              boxShadow: '0 2px 12px rgba(90,21,21,0.03)',
              marginBottom: 16,
              transition: 'box-shadow 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 3, height: 14, borderRadius: 2,
                    background: 'linear-gradient(180deg, #5A1515, rgba(90,21,21,0.3))',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2c1810' }}>발주 메시지</span>
                </div>
                <button onClick={copyMessage} className="order-copy-btn" style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: copied ? '1px solid #16a34a' : '1px solid rgba(90,21,21,0.1)',
                  background: copied ? '#16a34a' : '#fff',
                  color: copied ? '#fff' : '#8a8580', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.02em',
                }}>
                  {copied ? '복사됨!' : '복사'}
                </button>
              </div>
              <pre style={{
                fontSize: 13, color: '#2c1810', lineHeight: 1.75,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                margin: 0, fontFamily: "'DM Sans', -apple-system, sans-serif",
                background: '#faf9f7', borderRadius: 10, padding: '14px 16px',
                border: '1px solid rgba(90,21,21,0.04)',
              }}>
                {staffMessage}
              </pre>
            </div>

            {/* ─── Item List ─── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#a8a098', marginBottom: 10,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>품목 상세</span>
                <span style={{
                  fontSize: 10, fontWeight: 500, color: '#b8b0a8',
                  padding: '1px 6px', background: 'rgba(90,21,21,0.04)', borderRadius: 4,
                }}>{orderLines.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {orderLines.map((ol, lineIdx) => {
                  const sel = getSelected(ol);
                  const disc = discountRates[lineIdx] || 0;
                  const discPrice = sel ? Math.round(sel.supply_price * (1 - disc / 100)) : 0;
                  const isExpanded = expandedLines.has(lineIdx);
                  const isSearching = searchIdx === lineIdx;
                  const toggleExpand = () => setExpandedLines(prev => {
                    const next = new Set(prev);
                    if (next.has(lineIdx)) next.delete(lineIdx); else next.add(lineIdx);
                    return next;
                  });

                  return (
                    <div key={lineIdx} className="order-line-card" style={{
                      background: '#fff', borderRadius: 10,
                      border: '1px solid rgba(90,21,21,0.06)',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s ease',
                    }}>
                      {/* 컴팩트 한 줄 요약 */}
                      <div style={{
                        padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer',
                      }} onClick={toggleExpand}>
                        {/* 펼침 아이콘 */}
                        <span style={{
                          fontSize: 8, color: '#a8a098', flexShrink: 0,
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          display: 'inline-block',
                        }}>▶</span>

                        {/* 선택된 품목명 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {sel ? (
                            <span style={{
                              fontSize: 13, fontWeight: 600, color: '#2c1810',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              display: 'block',
                            }}>
                              {sel.item_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>미선택</span>
                          )}
                          <span style={{ fontSize: 10, color: '#b8b0a8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            {sel?.item_no || ''} · &quot;{ol.query}&quot;
                            {sel?.incoming && (
                              <span style={{
                                fontSize: 8, fontWeight: 700, color: '#0369a1',
                                background: '#e0f2fe', padding: '0px 4px', borderRadius: 3,
                              }}>입고</span>
                            )}
                          </span>
                        </div>

                        {/* 수량 */}
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: '#5A1515',
                          flexShrink: 0, minWidth: 32, textAlign: 'right',
                        }}>
                          {ol.quantity}{getUnit(sel?.item_no, sel?.item_name)}
                        </span>

                        {/* 신뢰도 */}
                        {sel && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: confColor(sel.confidence),
                            padding: '2px 6px', borderRadius: 4,
                            background: `${confColor(sel.confidence)}0a`,
                            border: `1px solid ${confColor(sel.confidence)}20`,
                            flexShrink: 0,
                          }}>
                            {Math.round(sel.confidence * 100)}%
                          </span>
                        )}
                      </div>

                      {/* 펼쳐진 상세 */}
                      {isExpanded && (
                        <div style={{
                          borderTop: '1px solid rgba(90,21,21,0.05)',
                          animation: 'orderSlideIn 0.15s ease',
                        }}>
                          {/* 수량 조절 + 삭제 */}
                          <div style={{
                            padding: '8px 14px', background: '#faf9f7',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 12, color: '#5A1515', fontWeight: 600 }}>
                              &quot;{ol.query}&quot;
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button onClick={() => updateQty(lineIdx, ol.quantity - 1)}
                                className="order-qty-btn"
                                style={{
                                  width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                                  background: '#fff', cursor: 'pointer', fontSize: 14, color: '#5A1515',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}>-</button>
                              <input type="text" inputMode="numeric"
                                value={editingQty[lineIdx] !== undefined ? editingQty[lineIdx] : ol.quantity}
                                onChange={e => setEditingQty(prev => ({ ...prev, [lineIdx]: e.target.value }))}
                                onBlur={() => {
                                  const val = editingQty[lineIdx];
                                  if (val !== undefined) {
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num) && num >= 1) updateQty(lineIdx, num);
                                    setEditingQty(prev => { const n = { ...prev }; delete n[lineIdx]; return n; });
                                  }
                                }}
                                style={{
                                  width: 34, textAlign: 'center', fontSize: 14, fontWeight: 700,
                                  border: '1px solid rgba(90,21,21,0.1)', borderRadius: 6,
                                  padding: '3px 0', color: '#2c1810', background: '#fff',
                                }}
                              />
                              <button onClick={() => updateQty(lineIdx, ol.quantity + 1)}
                                className="order-qty-btn"
                                style={{
                                  width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                                  background: '#fff', cursor: 'pointer', fontSize: 14, color: '#5A1515',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}>+</button>
                              <button onClick={() => removeLine(lineIdx)} style={{
                                width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(220,38,38,0.1)',
                                background: 'rgba(220,38,38,0.03)', cursor: 'pointer', fontSize: 12,
                                color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginLeft: 4, transition: 'all 0.15s ease',
                              }}>x</button>
                            </div>
                          </div>

                          {/* 후보 리스트 */}
                          <div style={{ padding: '4px 0' }}>
                            {ol.candidates.map((cand, cIdx) => {
                              const isSelected = ol.selectedIdx === cIdx;
                              const hasHistory = historySet.has(cand.item_no.trim().toUpperCase());
                              return (
                                <button key={cIdx} onClick={() => selectCandidate(lineIdx, cIdx)}
                                  className="order-cand-btn"
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    width: '100%', padding: '7px 14px', border: 'none',
                                    background: isSelected ? 'rgba(90,21,21,0.03)' : hasHistory ? 'rgba(22,163,74,0.04)' : 'transparent',
                                    cursor: 'pointer', textAlign: 'left',
                                    borderLeft: isSelected ? '3px solid #5A1515' : hasHistory ? '3px solid rgba(22,163,74,0.3)' : '3px solid transparent',
                                    transition: 'all 0.15s ease',
                                  }}>
                                  <span style={{
                                    width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                                    border: isSelected ? '2px solid #5A1515' : '2px solid #d8d3ce',
                                    background: isSelected ? '#5A1515' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s ease',
                                  }}>
                                    {isSelected && <span style={{ width: 5, height: 5, borderRadius: 3, background: '#fff' }} />}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: 12, fontWeight: isSelected ? 700 : 500,
                                      color: isSelected ? '#2c1810' : '#888',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                      display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                      {cand.item_name}
                                      {hasHistory && (
                                        <span style={{ fontSize: 8, color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>●</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#b8b0a8', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                      {cand.item_no} · 재고 {cand.available_stock} · {cand.reasoning}
                                      {cand.incoming && (
                                        <span style={{
                                          fontSize: 8, fontWeight: 700, color: '#0369a1',
                                          background: '#e0f2fe', padding: '0px 4px', borderRadius: 3,
                                          border: '1px solid #bae6fd',
                                        }}>입고 {cand.incoming.arrival_date.slice(5)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, color: confColor(cand.confidence),
                                    padding: '2px 6px', borderRadius: 4,
                                    background: `${confColor(cand.confidence)}0a`,
                                    border: `1px solid ${confColor(cand.confidence)}20`,
                                    flexShrink: 0,
                                  }}>
                                    {Math.round(cand.confidence * 100)}%
                                  </span>
                                </button>
                              );
                            })}

                            {/* 수동 검색 */}
                            <div style={{ padding: '4px 14px 8px', position: 'relative' }} ref={isSearching ? searchRef : undefined}>
                              {!isSearching ? (
                                <button onClick={() => { setSearchIdx(lineIdx); setSearchQuery(''); setSearchResults([]); }} style={{
                                  fontSize: 11, color: '#5A1515', background: 'none', border: 'none',
                                  cursor: 'pointer', fontWeight: 600, padding: '3px 0',
                                  textDecoration: 'underline', textUnderlineOffset: 3,
                                  opacity: 0.8, transition: 'opacity 0.15s ease',
                                }}>
                                  직접 검색하여 변경
                                </button>
                              ) : (
                                <div>
                                  <input type="text" value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="와인명 또는 품번 검색"
                                    autoFocus
                                    style={{
                                      width: '100%', fontSize: 16, padding: '8px 12px', borderRadius: 8,
                                      border: '1.5px solid #5A1515', background: '#fff', color: '#2c1810',
                                      outline: 'none', boxSizing: 'border-box',
                                    }}
                                  />
                                  {searchLoading && (
                                    <div style={{ fontSize: 11, color: '#a8a098', padding: '6px 0' }}>
                                      <span style={{ animation: 'orderPulse 1.2s ease-in-out infinite' }}>검색 중...</span>
                                    </div>
                                  )}
                                  {searchResults.length > 0 && (
                                    <div style={{
                                      maxHeight: 200, overflowY: 'auto', marginTop: 4,
                                      border: '1px solid rgba(90,21,21,0.08)', borderRadius: 8,
                                      background: '#fff', boxShadow: '0 8px 24px rgba(90,21,21,0.08)',
                                    }}>
                                      {searchResults.map(sr => (
                                        <button key={sr.item_no} onClick={() => replaceWithSearch(lineIdx, sr)}
                                          className="order-search-item"
                                          style={{
                                            display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                                            background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                            borderBottom: '1px solid rgba(90,21,21,0.03)',
                                            transition: 'background 0.15s ease',
                                          }}>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: '#2c1810' }}>{sr.item_name}</div>
                                          <div style={{ fontSize: 10, color: '#a8a098', marginTop: 2 }}>
                                            {sr.item_no} · 공급가 {fmt(sr.supply_price || 0)} · 재고 {sr.available_stock || 0}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {searchQuery && !searchLoading && searchResults.length === 0 && (
                                    <div style={{ fontSize: 11, color: '#b8b0a8', padding: '6px 0' }}>검색 결과 없음</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 가격/할인 */}
                          {sel && (
                            <div style={{
                              padding: '8px 14px 10px',
                              borderTop: '1px solid rgba(90,21,21,0.04)',
                              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                              background: '#faf9f7',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 11, color: '#a8a098', fontWeight: 500 }}>공급가</span>
                                <input type="text" inputMode="numeric"
                                  value={editingPrice[lineIdx] !== undefined ? editingPrice[lineIdx] : sel.supply_price.toLocaleString()}
                                  onChange={e => setEditingPrice(prev => ({ ...prev, [lineIdx]: e.target.value }))}
                                  onBlur={() => {
                                    const val = editingPrice[lineIdx];
                                    if (val !== undefined) {
                                      const num = parseInt(val.replace(/,/g, ''), 10);
                                      if (!isNaN(num) && num >= 0) updatePrice(lineIdx, num);
                                      setEditingPrice(prev => { const n = { ...prev }; delete n[lineIdx]; return n; });
                                    }
                                  }}
                                  style={{
                                    width: 78, textAlign: 'right', fontSize: 12, fontWeight: 600,
                                    border: sel.supply_price === 0 ? '1.5px solid #d97706' : '1px solid rgba(90,21,21,0.1)',
                                    borderRadius: 6, padding: '3px 6px', color: '#2c1810',
                                    background: sel.supply_price === 0 ? '#fffbeb' : '#fff',
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 11, color: '#a8a098', fontWeight: 500 }}>할인</span>
                                <select
                                  value={customDiscountInput[lineIdx] !== undefined ? 'custom' : disc === 100 ? 'tasting' : disc}
                                  onChange={e => {
                                    const v = e.target.value;
                                    if (v === 'custom') {
                                      setCustomDiscountInput(prev => ({ ...prev, [lineIdx]: String(disc > 0 && disc < 100 ? disc : '') }));
                                    } else if (v === 'tasting') {
                                      setCustomDiscountInput(prev => { const n = { ...prev }; delete n[lineIdx]; return n; });
                                      updateDiscount(lineIdx, 100);
                                    } else {
                                      setCustomDiscountInput(prev => { const n = { ...prev }; delete n[lineIdx]; return n; });
                                      updateDiscount(lineIdx, Number(v));
                                    }
                                  }}
                                  style={{
                                    fontSize: 12, fontWeight: 600, padding: '3px 4px', borderRadius: 6,
                                    border: '1px solid rgba(90,21,21,0.1)', background: '#fff',
                                    color: disc > 0 ? '#5A1515' : '#a8a098', cursor: 'pointer',
                                  }}
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={10}>10%</option>
                                  <option value={15}>15%</option>
                                  <option value={20}>20%</option>
                                  <option value={25}>25%</option>
                                  <option value={30}>30%</option>
                                  <option value={35}>35%</option>
                                  <option value={40}>40%</option>
                                  <option value={45}>45%</option>
                                  <option value={50}>50%</option>
                                  <option value="custom">직접입력</option>
                                  <option value="tasting">🍷 시음주</option>
                                </select>
                                {customDiscountInput[lineIdx] !== undefined && (
                                  <input
                                    type="text" inputMode="numeric" autoFocus
                                    placeholder="%"
                                    value={customDiscountInput[lineIdx]}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/[^0-9]/g, '');
                                      setCustomDiscountInput(prev => ({ ...prev, [lineIdx]: raw }));
                                    }}
                                    onBlur={() => {
                                      const num = parseInt(customDiscountInput[lineIdx] || '0', 10);
                                      const clamped = Math.min(Math.max(num, 0), 99);
                                      updateDiscount(lineIdx, clamped);
                                      setCustomDiscountInput(prev => { const n = { ...prev }; delete n[lineIdx]; return n; });
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    }}
                                    style={{
                                      width: 44, textAlign: 'center', fontSize: 12, fontWeight: 600,
                                      border: '1.5px solid #5A1515', borderRadius: 6, padding: '3px 4px',
                                      color: '#5A1515', background: '#fff',
                                    }}
                                  />
                                )}
                              </div>
                              {disc === 100 && (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color: '#fff', background: '#5A1515',
                                  padding: '2px 8px', borderRadius: 10,
                                }}>
                                  시음주
                                </span>
                              )}
                              {disc > 0 && disc < 100 && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A1515' }}>
                                  → {fmt(discPrice)}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: '#b8b0a8', marginLeft: 'auto', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                재고 {sel.available_stock}
                                {sel.incoming && (
                                  <span style={{
                                    fontSize: 9, fontWeight: 700, color: '#0369a1',
                                    background: '#e0f2fe', padding: '1px 6px', borderRadius: 4,
                                    border: '1px solid #bae6fd',
                                  }}>
                                    입고 {sel.incoming.arrival_date.slice(5)} · {sel.incoming.total_btls}병
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 토큰 */}
            {usage && (
              <div style={{
                textAlign: 'center', fontSize: 10, color: '#c8c0b8', marginBottom: 16,
                letterSpacing: '0.02em',
              }}>
                {usage.input_tokens.toLocaleString()} in / {usage.output_tokens.toLocaleString()} out
                · ~${((usage.input_tokens * 0.8 + usage.output_tokens * 4) / 1e6).toFixed(4)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
