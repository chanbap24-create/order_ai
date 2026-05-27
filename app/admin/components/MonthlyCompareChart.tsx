'use client';

interface MonthlyItem { month: string; qty: number; amount: number }
interface YearlyItem { year: string; qty: number; amount: number }

function fmt(n: number) { return n.toLocaleString(); }
function fmtM(n: number) { return n >= 100000000 ? (n / 100000000).toFixed(1) + '억' : n >= 10000 ? Math.round(n / 10000).toLocaleString() + '만' : fmt(n); }

export default function MonthlyCompareChart({
  data, yearly, startYear, endYear,
}: {
  data: MonthlyItem[]; yearly: YearlyItem[]; startYear: string; endYear: string;
}) {
  if (data.length === 0) return null;

  const byYear: Record<string, Record<string, { qty: number; amount: number }>> = {};
  for (const m of data) {
    const yr = m.month.slice(0, 4);
    const mo = m.month.slice(5, 7);
    if (!byYear[yr]) byYear[yr] = {};
    byYear[yr][mo] = { qty: m.qty, amount: m.amount };
  }

  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const curYear = endYear;
  const prevYear = String(Number(curYear) - 1);
  const curData = byYear[curYear] || {};
  const prevData = byYear[prevYear] || {};

  const allQty = [...Object.values(curData).map(v => v.qty), ...Object.values(prevData).map(v => v.qty)];
  const maxQty = Math.max(...allQty, 1);

  const curYearly = yearly.find(y => y.year === curYear);
  const prevYearly = yearly.find(y => y.year === prevYear);
  const curQtyTotal = curYearly?.qty || 0;
  const prevQtyTotal = prevYearly?.qty || 0;
  const curAmtTotal = curYearly?.amount || 0;
  const prevAmtTotal = prevYearly?.amount || 0;
  const qtyYoY = prevQtyTotal > 0 ? Math.round((curQtyTotal - prevQtyTotal) / prevQtyTotal * 100) : 0;
  const amtYoY = prevAmtTotal > 0 ? Math.round((curAmtTotal - prevAmtTotal) / prevAmtTotal * 100) : 0;

  // 분기별 소계
  const quarters = [
    { label: 'Q1', months: ['01','02','03'] },
    { label: 'Q2', months: ['04','05','06'] },
    { label: 'Q3', months: ['07','08','09'] },
    { label: 'Q4', months: ['10','11','12'] },
  ];

  return (
    <div>
      {/* YoY 요약 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-muted)', borderRadius: 8, padding: '8px 14px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--action)', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{curYear}</span>
          <span style={{ fontSize: 12, color: '#666' }}>{fmt(curQtyTotal)}병</span>
          <span style={{ fontSize: 11, color: '#999' }}>{fmtM(curAmtTotal)}</span>
        </div>
        {prevQtyTotal > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f3f0', borderRadius: 8, padding: '8px 14px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#D8CCC0', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{prevYear}</span>
            <span style={{ fontSize: 12, color: '#666' }}>{fmt(prevQtyTotal)}병</span>
            <span style={{ fontSize: 11, color: '#999' }}>{fmtM(prevAmtTotal)}</span>
          </div>
        )}
        {prevQtyTotal > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: '#888' }}>병수 </span>
              <span style={{ fontWeight: 700, color: qtyYoY >= 0 ? '#16a34a' : '#dc2626' }}>{qtyYoY >= 0 ? '+' : ''}{qtyYoY}%</span>
            </div>
            <div style={{ fontSize: 11 }}>
              <span style={{ color: '#888' }}>매출 </span>
              <span style={{ fontWeight: 700, color: amtYoY >= 0 ? '#16a34a' : '#dc2626' }}>{amtYoY >= 0 ? '+' : ''}{amtYoY}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 12개월 비교 봉차트 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, minHeight: 140 }}>
        {months.map((mo, i) => {
          const cur = curData[mo]?.qty || 0;
          const prev = prevData[mo]?.qty || 0;
          const curH = Math.max(cur > 0 ? 3 : 0, cur / maxQty * 110);
          const prevH = Math.max(prev > 0 ? 3 : 0, prev / maxQty * 110);
          const moGrowth = prev > 0 ? Math.round((cur - prev) / prev * 100) : 0;
          return (
            <div key={mo} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: 110 }}>
                {prevQtyTotal > 0 && (
                  <div title={`${prevYear}.${mo}: ${fmt(prev)}병`} style={{ width: '40%', height: prevH, background: '#D8CCC0', borderRadius: '2px 2px 0 0' }} />
                )}
                <div title={`${curYear}.${mo}: ${fmt(cur)}병${prev > 0 ? ` (${moGrowth >= 0 ? '+' : ''}${moGrowth}%)` : ''}`}
                  style={{ width: prevQtyTotal > 0 ? '40%' : '70%', height: curH, background: 'var(--action)', borderRadius: '2px 2px 0 0' }} />
              </div>
              <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>{i + 1}월</div>
            </div>
          );
        })}
      </div>

      {/* 분기별 소계 */}
      {prevQtyTotal > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {quarters.map(q => {
            const curQ = q.months.reduce((s, m) => s + (curData[m]?.qty || 0), 0);
            const prevQ = q.months.reduce((s, m) => s + (prevData[m]?.qty || 0), 0);
            const curA = q.months.reduce((s, m) => s + (curData[m]?.amount || 0), 0);
            const prevA = q.months.reduce((s, m) => s + (prevData[m]?.amount || 0), 0);
            const qG = prevQ > 0 ? Math.round((curQ - prevQ) / prevQ * 100) : 0;
            const aG = prevA > 0 ? Math.round((curA - prevA) / prevA * 100) : 0;
            return (
              <div key={q.label} style={{ background: 'var(--surface-muted)', borderRadius: 8, padding: '10px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{q.label}</div>
                {/* 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 4, fontSize: 9, color: '#bbb', fontWeight: 500, marginBottom: 3 }}>
                  <div style={{ textAlign: 'right' }}>{prevYear}</div>
                  <div style={{ textAlign: 'right' }}>{curYear}</div>
                  <div style={{ textAlign: 'right' }}></div>
                </div>
                {/* 병수 행 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 4, fontSize: 11, marginBottom: 3, alignItems: 'baseline' }}>
                  <div style={{ textAlign: 'right', color: '#999' }}>{fmt(prevQ)}</div>
                  <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(curQ)}</div>
                  <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 700, color: qG >= 0 ? '#16a34a' : '#dc2626' }}>{prevQ > 0 ? `${qG >= 0 ? '+' : ''}${qG}%` : ''}</div>
                </div>
                {/* 매출 행 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 4, fontSize: 10, alignItems: 'baseline' }}>
                  <div style={{ textAlign: 'right', color: '#bbb' }}>{fmtM(prevA)}</div>
                  <div style={{ textAlign: 'right', color: '#666', fontWeight: 600 }}>{fmtM(curA)}</div>
                  <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 700, color: aG >= 0 ? '#16a34a' : '#dc2626' }}>{prevA > 0 ? `${aG >= 0 ? '+' : ''}${aG}%` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
