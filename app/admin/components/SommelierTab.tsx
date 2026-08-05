'use client';

// 소믈리에(백화점 취향 문답) 이력 — 고객별 문답 세션·답변·추천·구매 기록 열람.
// KREAM 문법: 헤어라인 행 + 확장 상세.
import { useEffect, useState } from 'react';
import { BODY_OPTIONS, COUNTRY_OPTIONS, FLAVOR_GROUPS, PRICE_OPTIONS, TYPE_OPTIONS } from '@/app/sommelier/lib/quiz';
import { FLAVOR_KO } from '@/app/api/sales/recommend/lib/flavor';

type Customer = { id: number; name: string; phone: string; created_at: string };
type Session = {
  id: number; customer_id: number; manager: string; created_at: string;
  answers: { type?: string | null; body?: string | null; flavors?: string[]; flavorGroups?: string[]; countries?: string[]; priceMin?: number | null; priceMax?: number | null };
  results: { item_code: string; name: string; retail_price: number }[];
};
type Order = { id: number; customer_id: number; session_id: number | null; item_code: string; item_name: string; retail_price: number; manager: string; created_at: string };

const won = (n: number) => (n || 0).toLocaleString('ko-KR');
const dt = (s: string) => new Date(s).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const maskPhone = (p: string) => (p?.length >= 8 ? `${p.slice(0, 3)}-${p.slice(3, -4).replace(/\d/g, '*')}-${p.slice(-4)}` : p);

/** 답변 JSON → 사람이 읽는 요약 */
function answerSummary(a: Session['answers']): string {
  const parts: string[] = [];
  const t = TYPE_OPTIONS.find((o) => o.value === a.type); if (t?.value) parts.push(t.label);
  const b = BODY_OPTIONS.find((o) => o.value === a.body); if (b?.value) parts.push(b.label);
  for (const g of a.flavorGroups || []) parts.push(`${FLAVOR_GROUPS[g]?.label || g}(전체)`);
  for (const f of a.flavors || []) parts.push(FLAVOR_KO[f] || f);
  for (const c of a.countries || []) parts.push(COUNTRY_OPTIONS[c]?.label || c);
  const p = PRICE_OPTIONS.find((o) => o.min === (a.priceMin ?? null) && o.max === (a.priceMax ?? null));
  if (p && (p.min != null || p.max != null)) parts.push(p.label);
  return parts.join(' · ') || '전부 상관없음';
}

export default function SommelierTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const removeCustomer = async (c: Customer) => {
    if (!confirm(`${c.name} 고객과 문답·구매 기록을 모두 삭제할까요?`)) return;
    setDeleting(c.id);
    try {
      const r = await fetch('/api/admin/sommelier', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: c.id }),
      });
      if (!r.ok) throw new Error();
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setSessions((prev) => prev.filter((s) => s.customer_id !== c.id));
      setOrders((prev) => prev.filter((o) => o.customer_id !== c.id));
      setOpen(null);
    } catch {
      alert('삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetch('/api/admin/sommelier').then((r) => r.json())
      .then((j) => {
        setCustomers(j.customers || []); setSessions(j.sessions || []); setOrders(j.orders || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>불러오는 중…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* 스탯 스트립 */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
        {[['고객', customers.length], ['문답 세션', sessions.length], ['구매 기록', orders.length]].map(([label, v], i) => (
          <div key={String(label)} style={{ flex: 1, padding: '13px 0', textAlign: 'center', borderLeft: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>

      {customers.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>아직 기록된 고객이 없습니다</div>
      )}

      {customers.map((c) => {
        const cs = sessions.filter((s) => s.customer_id === c.id);
        const co = orders.filter((o) => o.customer_id === c.id);
        const isOpen = open === c.id;
        return (
          <div key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <button onClick={() => setOpen(isOpen ? null : c.id)} style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 12,
              width: '100%', padding: '15px 4px', boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{maskPhone(c.phone)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                문답 {cs.length} · 구매 {co.length} · {new Date(c.created_at).toLocaleDateString('ko-KR')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div style={{ padding: '2px 4px 18px' }}>
                {co.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>구매 기록</div>
                    {co.map((o) => (
                      <div key={o.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600 }}>{o.item_name || o.item_code}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{won(o.retail_price)}원</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>{o.manager} · {dt(o.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>문답 이력</div>
                {cs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>문답 기록 없음</div>}
                {cs.map((s) => (
                  <div key={s.id} style={{ padding: '9px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>{dt(s.created_at)}</span><span>담당 {s.manager}</span>
                    </div>
                    <div style={{ fontSize: 13.5, marginBottom: 5 }}>{answerSummary(s.answers || {})}</div>
                    {Array.isArray(s.results) && s.results.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
                        추천: {s.results.map((r) => `${r.name}(${won(r.retail_price)}원)`).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ paddingTop: 12, textAlign: 'right' }}>
                  <button onClick={() => removeCustomer(c)} disabled={deleting === c.id} style={{
                    all: 'unset', cursor: 'pointer', fontSize: 12, color: 'var(--status-danger)',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                  }}>
                    {deleting === c.id ? '삭제 중…' : '고객 삭제'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
