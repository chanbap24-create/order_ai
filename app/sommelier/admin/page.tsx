'use client';

// 소믈리에 관리자 — 계정별 실적 랭킹 + 인기 와인 + 할인율 설정 진입 (권한자 전용 MVP).
// 지표 설계: 등록(신규 손님) → 상담(문답 세션) → 판매(병수·금액) 퍼널 + 전환율·재방문.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type MgrRow = { manager: string; customers: number; sessions: number; revisits: number; bottles: number; amount: number; conversion: number };
type WineRow = { item_code: string; name: string; bottles: number; amount: number };
type Stats = { managers: MgrRow[]; topWines: WineRow[]; total: { customers: number; sessions: number; bottles: number; amount: number } };

const won = (n: number) => n.toLocaleString('ko-KR');
const PERIODS: { key: string; label: string }[] = [
  { key: '0', label: '오늘' }, { key: '7', label: '7일' }, { key: '30', label: '30일' }, { key: 'all', label: '전체' },
];

const th: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary, #999)', fontWeight: 500, textAlign: 'right', padding: '0 0 8px' };
const td: React.CSSProperties = { fontSize: 13.5, textAlign: 'right', padding: '11px 0', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--border-subtle, #f0f0f0)' };

export default function SommelierAdminPage() {
  const router = useRouter();
  const [period, setPeriod] = useState('7');
  // 로딩 상태는 파생값(요청 기간 ≠ 로드된 기간) — effect 안 동기 setState 회피
  const [loaded, setLoaded] = useState<{ period: string; stats: Stats | null; err: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sommelier/admin/stats?days=${period}`)
      .then(async (r) => {
        const d = await r.json();
        // 권한자(박경아·조성재) 외에는 페이지 자체를 열어두지 않는다 — 즉시 메인으로
        if (r.status === 401 || r.status === 403) { router.replace('/sommelier'); return; }
        if (alive) setLoaded({ period, stats: d.success ? d : null, err: d.success ? '' : (d.error || '불러오기 실패') });
      })
      .catch(() => { if (alive) setLoaded({ period, stats: null, err: '불러오기 실패' }); });
    return () => { alive = false; };
  }, [period, router]);

  const stats = loaded?.stats ?? null;
  const err = loaded?.err ?? '';
  const loading = loaded?.period !== period;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px', color: 'var(--text-primary, #111)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>소믈리에 관리자</h1>
        <Link href="/sommelier" style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', textDecoration: 'none' }}>← 소믈리에</Link>
      </div>

      {/* 기간 토글 — 플랫, 세로 구분선 */}
      <div style={{ display: 'flex', gap: 0, margin: '18px 0 6px' }}>
        {PERIODS.map((p, i) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: '6px 14px',
              fontSize: 13, fontWeight: period === p.key ? 700 : 400,
              color: period === p.key ? 'var(--text-primary, #111)' : 'var(--text-tertiary, #999)',
              borderLeft: i > 0 ? '1px solid var(--border-subtle, #eee)' : 'none',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {err && <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--status-danger, #b91c1c)' }}>{err}</div>}
      {loading && !stats && <div style={{ padding: '24px 0', fontSize: 13, color: 'var(--text-tertiary, #999)' }}>불러오는 중</div>}

      {stats && (
        <div style={{ opacity: loading ? 0.5 : 1 }}>
          {/* 요약 스트립 */}
          <div style={{
            display: 'flex', borderTop: '1px solid var(--border-default, #e5e5e5)',
            borderBottom: '1px solid var(--border-default, #e5e5e5)', margin: '10px 0 22px',
          }}>
            {[['등록', stats.total.customers, '명'], ['상담', stats.total.sessions, '건'],
              ['판매', stats.total.bottles, '병'], ['판매액', won(stats.total.amount), '원']].map(([label, val, unit], i) => (
              <div key={String(label)} style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border-subtle, #eee)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #999)' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {val}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 1 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 계정별 랭킹 */}
          <div style={{ fontSize: 13.5, fontWeight: 700, padding: '0 0 8px' }}>계정별 실적</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>계정</th>
                <th style={th}>등록</th>
                <th style={th}>상담</th>
                <th style={th}>재방문</th>
                <th style={th}>병수</th>
                <th style={th}>전환</th>
                <th style={th}>판매액</th>
              </tr>
            </thead>
            <tbody>
              {stats.managers.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-tertiary, #999)' }}>기간 내 기록이 없습니다</td></tr>
              )}
              {stats.managers.map((m, i) => (
                <tr key={m.manager}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: i === 0 && m.amount > 0 ? 700 : 500 }}>
                    <span style={{ display: 'inline-block', width: 20, color: 'var(--text-tertiary, #bbb)', fontSize: 11.5 }}>{i + 1}</span>
                    {m.manager}
                  </td>
                  <td style={td}>{m.customers}</td>
                  <td style={td}>{m.sessions}</td>
                  <td style={td}>{m.revisits}</td>
                  <td style={td}>{m.bottles}</td>
                  <td style={td}>{m.conversion}%</td>
                  <td style={{ ...td, fontWeight: 600 }}>{won(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 인기 와인 */}
          <div style={{ fontSize: 13.5, fontWeight: 700, padding: '26px 0 4px' }}>인기 와인</div>
          {stats.topWines.length === 0 ? (
            <div style={{ padding: '12px 0', fontSize: 12.5, color: 'var(--text-tertiary, #999)', borderTop: '1px solid var(--border-subtle, #f0f0f0)' }}>
              기간 내 판매 기록이 없습니다
            </div>
          ) : stats.topWines.map((w) => (
            <div key={w.item_code} style={{
              display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0',
              borderTop: '1px solid var(--border-subtle, #f0f0f0)', fontSize: 13,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-secondary, #555)' }}>
                {w.bottles}병 · {won(w.amount)}원
              </span>
            </div>
          ))}

          <Link href="/sommelier/pricing" style={{
            display: 'block', marginTop: 30, padding: '13px 0', textAlign: 'center',
            border: '1px solid var(--border-default, #ddd)', borderRadius: 10,
            fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary, #111)', textDecoration: 'none',
          }}>
            할인율 설정 →
          </Link>
        </div>
      )}
    </div>
  );
}
