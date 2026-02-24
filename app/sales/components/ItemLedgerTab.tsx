'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ItemRow {
  ship_date: string;
  client_code: string;
  client_name: string;
  manager: string;
  department: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
}

interface ClientSummary {
  client_name: string;
  total_qty: number;
  total_amount: number;
  avg_price: number;
  ship_count: number;
  last_date: string;
  first_date: string;
}

interface SearchItem { item_no: string; item_name: string; }

function fmt(n: number) { return n.toLocaleString(); }

export default function ItemLedgerTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  // 검색
  const [itemSearch, setItemSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // 기간
  const now = new Date();
  const y = now.getFullYear();
  const today = now.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(`${y}-01-01`);
  const [endDate, setEndDate] = useState(today);

  // 창고
  const [warehouse, setWarehouse] = useState<'CDV' | 'DL'>('CDV');

  // 뷰 모드
  const [viewMode, setViewMode] = useState<'date' | 'client'>('date');

  // 결과
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
  const [itemName, setItemName] = useState('');
  const [totals, setTotals] = useState({ qty: 0, supply: 0, clients: 0 });
  const [error, setError] = useState('');

  // 품목 검색
  const searchTimer = useRef<any>(null);
  const handleSearchChange = useCallback((val: string) => {
    setItemSearch(val);
    setSelectedItem(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sales/item-search?q=${encodeURIComponent(val)}&warehouse=${warehouse}`);
        const data = await res.json();
        if (data.items) {
          setSuggestions(data.items);
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
  }, [warehouse]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 품목 선택
  const selectItem = (item: SearchItem) => {
    setSelectedItem(item);
    setItemSearch(item.item_name);
    setShowSuggestions(false);
  };

  // 조회
  const handleSearch = async () => {
    if (!selectedItem) { setError('품목을 선택해주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        item_no: selectedItem.item_no,
        start_date: startDate,
        end_date: endDate,
        warehouse,
      });
      const res = await fetch(`/api/sales/item-ledger?${params}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRows(data.rows || []);
      setClientSummary(data.client_summary || []);
      setItemName(data.item_name || selectedItem.item_name);
      setTotals(data.totals || { qty: 0, supply: 0, clients: 0 });
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 창고 변경 시 검색 초기화
  const handleWarehouseChange = (w: 'CDV' | 'DL') => {
    setWarehouse(w);
    setSelectedItem(null);
    setItemSearch('');
    setSuggestions([]);
    setRows([]);
    setClientSummary([]);
  };

  return (
    <div>
      {/* 필터 영역 */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(90,21,21,0.06)',
        boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
        padding: 18,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c1810', marginBottom: 14 }}>
          품목별 판매현황
        </div>

        {/* 창고 선택 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            창고
          </label>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(90,21,21,0.04)', borderRadius: 8, padding: 2, width: 'fit-content' }}>
            {([['CDV', '까브드뱅 (와인)'], ['DL', '대유라이프 (글라스)']] as const).map(([w, label]) => (
              <button key={w} onClick={() => handleWarehouseChange(w as 'CDV' | 'DL')} style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                fontSize: 12, fontWeight: warehouse === w ? 700 : 500,
                background: warehouse === w ? '#fff' : 'transparent',
                color: warehouse === w ? '#5A1515' : '#8a8580',
                cursor: 'pointer', boxShadow: warehouse === w ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 품목 검색 */}
        <div ref={searchRef} style={{ position: 'relative', marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            제품코드 / 품목명
          </label>
          <input
            value={itemSearch}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="제품코드 또는 품목명 검색"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: selectedItem ? '1.5px solid rgba(90,21,21,0.25)' : '1.5px solid rgba(90,21,21,0.08)',
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
              background: selectedItem ? 'rgba(90,21,21,0.02)' : '#faf9f7',
            }}
          />
          {selectedItem && (
            <span style={{
              position: 'absolute', right: 12, top: 30,
              fontSize: 11, color: '#5A1515', fontWeight: 600, background: 'rgba(90,21,21,0.06)',
              padding: '2px 8px', borderRadius: 6,
            }}>
              {selectedItem.item_no}
            </span>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid rgba(90,21,21,0.08)',
              maxHeight: 300, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => selectItem(s)} style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,21,21,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, color: '#2c1810', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.item_name}</span>
                  <span style={{ fontSize: 11, color: '#8a8580', marginLeft: 8, flexShrink: 0 }}>{s.item_no}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 기간 + 조회 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              시작일
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16,
                outline: 'none', boxSizing: 'border-box', background: '#faf9f7',
              }}
            />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8580', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              종료일
            </label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid rgba(90,21,21,0.08)', fontSize: 16,
                outline: 'none', boxSizing: 'border-box', background: '#faf9f7',
              }}
            />
          </div>
          <button onClick={handleSearch} disabled={loading} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: loading ? '#c4a0a0' : '#5A1515', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            whiteSpace: 'nowrap', transition: 'background 0.2s',
          }}>
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 빠른 기간 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {getQuickRanges().map(r => (
            <button key={r.label} onClick={() => { setStartDate(r.start); setEndDate(r.end); }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(90,21,21,0.1)',
                background: (startDate === r.start && endDate === r.end) ? 'rgba(90,21,21,0.06)' : 'transparent',
                fontSize: 11, color: '#5A1515', cursor: 'pointer', fontWeight: 500,
              }}>
              {r.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
            {error}
          </div>
        )}
      </div>

      {/* 결과 영역 */}
      {rows.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 14,
          border: '1px solid rgba(90,21,21,0.06)',
          boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
          overflow: 'hidden',
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '2px solid #5A1515',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2c1810' }}>{itemName}</span>
              <span style={{ fontSize: 12, color: '#8a8580', marginLeft: 8 }}>{selectedItem?.item_no}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#8a8580' }}>
                {totals.clients}개 거래처 · {rows.length}건
              </span>
              {/* 뷰 전환 */}
              <div style={{ display: 'flex', gap: 2, background: 'rgba(90,21,21,0.04)', borderRadius: 6, padding: 2 }}>
                {([['date', '날짜별'], ['client', '거래처별']] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setViewMode(m as 'date' | 'client')} style={{
                    padding: '4px 10px', borderRadius: 4, border: 'none',
                    fontSize: 11, fontWeight: viewMode === m ? 700 : 500,
                    background: viewMode === m ? '#fff' : 'transparent',
                    color: viewMode === m ? '#5A1515' : '#8a8580',
                    cursor: 'pointer', boxShadow: viewMode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 요약 카드 */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(90,21,21,0.08)' }}>
            {[
              { label: '총 수량', value: fmt(totals.qty), unit: '' },
              { label: '총 금액', value: fmt(totals.supply), unit: '원' },
              { label: '거래처 수', value: String(totals.clients), unit: '개' },
            ].map((card, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 16px', textAlign: 'center',
                borderRight: i < 2 ? '1px solid rgba(90,21,21,0.06)' : 'none',
              }}>
                <div style={{ fontSize: 10, color: '#8a8580', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#5A1515', marginTop: 2 }}>{card.value}<span style={{ fontSize: 11, fontWeight: 500, color: '#8a8580' }}>{card.unit}</span></div>
              </div>
            ))}
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {viewMode === 'date' ? (
              <DateView rows={rows} />
            ) : (
              <ClientView summary={clientSummary} />
            )}
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {selectedItem && rows.length === 0 && !loading && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 14,
          border: '1px solid rgba(90,21,21,0.06)',
        }}>
          해당 기간에 판매 내역이 없습니다.
        </div>
      )}

      {/* 안내 */}
      {!selectedItem && !loading && rows.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 40,
          textAlign: 'center', color: '#8a8580', fontSize: 13,
          border: '1px solid rgba(90,21,21,0.06)',
          lineHeight: 1.8,
        }}>
          제품코드 또는 품목명을 검색하고<br/>
          <strong style={{ color: '#5A1515' }}>조회</strong> 버튼을 눌러주세요.
        </div>
      )}
    </div>
  );
}

/* ━━━ 날짜별 뷰 ━━━ */
function DateView({ rows }: { rows: ItemRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
          <th style={thStyle}>판매원</th>
          <th style={thStyle}>출고일자</th>
          <th style={{ ...thStyle, minWidth: 160 }}>납품처명</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>수량</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>단가</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>금액</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, color: '#8a8580' }}>{r.manager || ''}</td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.ship_date?.slice(2)}</td>
            <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: r.quantity < 0 ? '#dc2626' : '#2c1810' }}>{fmt(r.quantity)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(r.unit_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: r.supply_amount < 0 ? '#dc2626' : '#2c1810' }}>{fmt(r.supply_amount)}</td>
          </tr>
        ))}
        {/* 합계 */}
        <tr style={{ background: '#5A1515', fontWeight: 700 }}>
          <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }} colSpan={3}>합계</td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(rows.reduce((s, r) => s + (r.quantity || 0), 0))}</td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(rows.reduce((s, r) => s + (r.supply_amount || 0), 0))}</td>
        </tr>
      </tbody>
    </table>
  );
}

/* ━━━ 거래처별 뷰 ━━━ */
function ClientView({ summary }: { summary: ClientSummary[] }) {
  const grandQty = summary.reduce((s, c) => s + c.total_qty, 0);
  const grandAmt = summary.reduce((s, c) => s + c.total_amount, 0);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8f6f4', borderBottom: '1px solid rgba(90,21,21,0.1)' }}>
          <th style={thStyle}>납품처명</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>횟수</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>총수량</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>평균단가</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>총금액</th>
          <th style={thStyle}>최초</th>
          <th style={thStyle}>최근</th>
        </tr>
      </thead>
      <tbody>
        {summary.map((c, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.client_name}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{c.ship_count}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.total_qty)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: '#8a8580' }}>{fmt(c.avg_price)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(c.total_amount)}</td>
            <td style={{ ...tdStyle, color: '#8a8580', whiteSpace: 'nowrap' }}>{c.first_date?.slice(2)}</td>
            <td style={{ ...tdStyle, color: '#8a8580', whiteSpace: 'nowrap' }}>{c.last_date?.slice(2)}</td>
          </tr>
        ))}
        {/* 합계 */}
        <tr style={{ background: '#5A1515', fontWeight: 700 }}>
          <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }}>합계 ({summary.length}개 거래처)</td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandQty)}</td>
          <td style={{ ...tdStyle, color: '#fff' }}></td>
          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandAmt)}</td>
          <td style={{ ...tdStyle, color: '#fff' }} colSpan={2}></td>
        </tr>
      </tbody>
    </table>
  );
}

/* ━━━ 빠른 기간 ━━━ */
function getQuickRanges() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;

  const curStart = `${y}-${pad(m + 1)}-01`;
  const prevStart = m === 0 ? `${y - 1}-12-01` : `${y}-${pad(m)}-01`;
  const prevEnd = new Date(y, m, 0);
  const prevEndStr = `${prevEnd.getFullYear()}-${pad(prevEnd.getMonth() + 1)}-${pad(prevEnd.getDate())}`;

  const q = Math.floor(m / 3);
  const qStart = `${y}-${pad(q * 3 + 1)}-01`;

  return [
    { label: '이번 달', start: curStart, end: today },
    { label: '지난 달', start: prevStart, end: prevEndStr },
    { label: '이번 분기', start: qStart, end: today },
    { label: '올해', start: `${y}-01-01`, end: today },
    { label: '작년', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
    { label: '전체', start: '2020-01-01', end: today },
  ];
}

function pad(n: number) { return String(n).padStart(2, '0'); }

/* ━━━ 스타일 ━━━ */
const thStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#5A1515',
  textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, color: '#2c1810', whiteSpace: 'nowrap',
};
