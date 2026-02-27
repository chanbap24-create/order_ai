'use client';

import { useState, useEffect, useCallback } from 'react';

interface OutstandingClient {
  client_code: string;
  client_name: string;
  prev_balance: number;
  period_supply: number;
  period_tax: number;
  period_total: number;
  period_payment: number;
  outstanding: number;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function OutstandingTab({ currentManager, isAdmin }: { currentManager: string; isAdmin: boolean }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<'wine' | 'glass'>('wine');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<OutstandingClient[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sales/outstanding?manager=${encodeURIComponent(currentManager)}&start_date=${startDate}&end_date=${endDate}&type=${type}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClients(data.clients || []);
      setChecked(new Set());
    } catch (e: any) {
      setError(e.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [currentManager, startDate, endDate, type]);

  useEffect(() => {
    if (currentManager) fetchData();
  }, [fetchData, currentManager]);

  // 전체선택
  const allChecked = clients.length > 0 && checked.size === clients.length;
  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(clients.map(c => c.client_code)));
    }
  };
  const toggleOne = (code: string) => {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setChecked(next);
  };

  // 합계
  const totals = clients.reduce(
    (acc, c) => ({
      prev_balance: acc.prev_balance + c.prev_balance,
      period_supply: acc.period_supply + c.period_supply,
      period_tax: acc.period_tax + c.period_tax,
      period_total: acc.period_total + c.period_total,
      period_payment: acc.period_payment + c.period_payment,
      outstanding: acc.outstanding + c.outstanding,
    }),
    { prev_balance: 0, period_supply: 0, period_tax: 0, period_total: 0, period_payment: 0, outstanding: 0 }
  );

  // ZIP 다운로드
  const handleExport = async (format: 'excel' | 'pdf' = 'excel') => {
    if (checked.size === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/sales/outstanding/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_codes: Array.from(checked),
          start_date: startDate,
          end_date: endDate,
          type,
          format,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `매출처원장_일괄_${startDate.slice(0, 7)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || '다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid rgba(90,21,21,0.06)',
    boxShadow: '0 2px 8px rgba(90,21,21,0.03)',
    padding: 18,
    marginBottom: 16,
  };

  return (
    <div>
      {/* 필터 */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580' }}>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1.5px solid rgba(90,21,21,0.08)',
                fontSize: 16,
                outline: 'none',
                background: '#faf9f7',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8580' }}>종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1.5px solid rgba(90,21,21,0.08)',
                fontSize: 16,
                outline: 'none',
                background: '#faf9f7',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['wine', 'glass'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: type === t ? '1.5px solid #5A1515' : '1.5px solid rgba(90,21,21,0.08)',
                  background: type === t ? 'rgba(90,21,21,0.06)' : 'transparent',
                  color: type === t ? '#5A1515' : '#8a8580',
                  fontSize: 13,
                  fontWeight: type === t ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {t === 'wine' ? 'Wine' : 'Glass'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#c4a0a0' : '#5A1515',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(220,38,38,0.04)',
          border: '1.5px solid rgba(220,38,38,0.15)',
          borderRadius: 10,
          fontSize: 13,
          color: '#dc2626',
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* 테이블 */}
      {clients.length > 0 && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
              <thead>
                <tr style={{ background: '#F5F0F0' }}>
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>거래처명</th>
                  <th style={thStyle}>전월미수</th>
                  <th style={thStyle}>판매</th>
                  <th style={thStyle}>부가세</th>
                  <th style={thStyle}>판매계</th>
                  <th style={thStyle}>입금</th>
                  <th style={thStyle}>현미수</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => {
                  const isChecked = checked.has(c.client_code);
                  return (
                    <tr
                      key={c.client_code}
                      style={{
                        background: isChecked ? 'rgba(90,21,21,0.03)' : i % 2 === 0 ? '#fff' : '#faf9f7',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleOne(c.client_code)}
                    >
                      <td style={tdCenter}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(c.client_code)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 16, height: 16, accentColor: '#5A1515', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#2c1810' }}>{c.client_name}</td>
                      <td style={tdRight}>{fmt(c.prev_balance)}</td>
                      <td style={tdRight}>{fmt(c.period_supply)}</td>
                      <td style={tdRight}>{fmt(c.period_tax)}</td>
                      <td style={{ ...tdRight, fontWeight: 600 }}>{fmt(c.period_total)}</td>
                      <td style={{ ...tdRight, color: '#1565C0' }}>{fmt(c.period_payment)}</td>
                      <td style={{
                        ...tdRight,
                        fontWeight: 700,
                        color: c.outstanding > 0 ? '#C62828' : c.outstanding < 0 ? '#1565C0' : '#2c1810',
                      }}>
                        {fmt(c.outstanding)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#5A1515' }}>
                  <td style={{ ...tdCenter, color: 'white' }} colSpan={2}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>합계 ({clients.length}개)</span>
                  </td>
                  <td style={tfRight}>{fmt(totals.prev_balance)}</td>
                  <td style={tfRight}>{fmt(totals.period_supply)}</td>
                  <td style={tfRight}>{fmt(totals.period_tax)}</td>
                  <td style={tfRight}>{fmt(totals.period_total)}</td>
                  <td style={tfRight}>{fmt(totals.period_payment)}</td>
                  <td style={tfRight}>{fmt(totals.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 다운로드 버튼 */}
      {clients.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => handleExport('excel')}
            disabled={checked.size === 0 || exporting}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: checked.size === 0 || exporting ? '#d4c5c5' : '#5A1515',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: checked.size === 0 || exporting ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {exporting ? '생성 중...' : `Excel (${checked.size}건)`}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={checked.size === 0 || exporting}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: checked.size === 0 || exporting ? '#d4c5c5' : '#C62828',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: checked.size === 0 || exporting ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {exporting ? '생성 중...' : `PDF (${checked.size}건)`}
          </button>
        </div>
      )}

      {!loading && clients.length === 0 && !error && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#a8a098',
          fontSize: 14,
        }}>
          해당 담당자의 거래처 미수현황이 없습니다.
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 700,
  color: '#5A1515',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '2px solid #5A1515',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  borderBottom: '1px solid rgba(90,21,21,0.06)',
  whiteSpace: 'nowrap',
};

const tdCenter: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  width: 40,
};

const tdRight: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const tfRight: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: 'white',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
