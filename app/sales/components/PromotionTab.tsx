'use client';
import { ListSkeleton } from '@/app/components/ui';

import { useCallback, useEffect, useState } from 'react';
import { PromotionForm, CATEGORY_OPTS, type PromotionDraft } from './promotion/PromotionForm';
import { DiscountConfigEditor } from './promotion/DiscountConfigEditor';

interface Promotion {
  id: string;
  item_no: string;
  item_name: string | null;
  quantity: number | null;
  discount_rate: number | null;
  discount_price: number | null;
  active: boolean;
  always_recommend: boolean;
  page_visible: boolean;
  categories: string[] | null;
  memo: string | null;
  total_stock?: number;
  available_stock?: number;
  bonded_warehouse?: number;
}

export default function PromotionTab() {
  const [list, setList] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/sales/promotions');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      setList(json.promotions || []);
    } catch (e) { setErr(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (d: PromotionDraft) => {
    const res = await fetch('/api/sales/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || '추가 실패'); return; }
    await load();
  };

  // 토글은 낙관적 업데이트 — 전체 load()는 스켈레톤 깜빡임(새로고침처럼 보임)이라 지양.
  //   로컬 상태만 즉시 반영하고 PATCH는 백그라운드, 실패 시에만 되돌린다.
  const patch = async (p: Promotion, body: Record<string, unknown>) => {
    setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...body } : x)));
    try {
      const res = await fetch('/api/sales/promotions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, ...body }),
      });
      if (!res.ok) throw new Error('update failed');
    } catch {
      setList((prev) => prev.map((x) => (x.id === p.id ? p : x))); // 롤백
      await load();
    }
  };
  const toggle = (p: Promotion) => patch(p, { active: !p.active });
  const toggleAlways = (p: Promotion) => patch(p, { always_recommend: !p.always_recommend });
  const togglePage = (p: Promotion) => patch(p, { page_visible: !p.page_visible });

  const remove = async (p: Promotion) => {
    if (!confirm(`'${p.item_name || p.item_no}' 프로모션을 삭제할까요?`)) return;
    await fetch(`/api/sales/promotions?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>프로모션</div>
        <button
          onClick={() => window.open('/promo', '_blank')}
          title="활성 프로모션으로 마케팅 상세페이지 자동 생성 — 이미지 저장·링크 공유 가능"
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'var(--action)', color: '#fff', whiteSpace: 'nowrap',
          }}
        >
          상세페이지 보기
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        여기 지정한 품목은 AI 추천 시 <b>최상위 규칙</b>으로 적용돼요(할인률·수량 고정, 최상단 노출).
        상세페이지는 활성 프로모션으로 자동 구성돼요.
      </div>

      <DiscountConfigEditor />

      <PromotionForm onSave={add} />

      {err && <div style={{ color: 'var(--danger, var(--status-danger))', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: 24, textAlign: 'center' }}>등록된 프로모션이 없어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
              background: '#fff', border: `1px solid ${p.active ? 'var(--promo-strong)' : 'var(--border-default)'}`,
              opacity: p.active ? 1 : 0.6,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {p.active && <span style={{ color: 'var(--promo-strong)', marginRight: 4 }}>🔥</span>}
                  {p.item_name || p.item_no}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {p.item_no}
                  {p.categories?.length
                    ? ` · ${p.categories.map((c) => CATEGORY_OPTS.find((o) => o.v === c)?.t || c).join('·')} 전용`
                    : ' · 전체 업태'}
                  {p.quantity ? ` · 수량 ${p.quantity}병` : ''}
                  {p.discount_rate != null ? ` · ${Math.round(p.discount_rate * 100)}%` : ''}
                  {p.discount_price ? ` · ${p.discount_price.toLocaleString()}원` : ''}
                  {p.memo ? ` · ${p.memo}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>재고 <b style={{ color: 'var(--text-secondary)' }}>{(p.total_stock ?? 0).toLocaleString()}</b></span>
                  <span>가용 <b style={{ color: (p.available_stock ?? 0) > 0 ? '#166534' : 'var(--status-danger)' }}>{(p.available_stock ?? 0).toLocaleString()}</b></span>
                  <span>보세 <b style={{ color: 'var(--text-secondary)' }}>{(p.bonded_warehouse ?? 0).toLocaleString()}</b></span>
                </div>
              </div>
              <button onClick={() => togglePage(p)} title="프로모션 상세페이지(/promo)에 이 와인 노출 여부" style={{
                padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-default)',
                background: p.page_visible ? 'color-mix(in srgb, var(--action) 8%, transparent)' : 'transparent', cursor: 'pointer',
                fontSize: 12, color: p.page_visible ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap',
              }}>{p.page_visible ? '상세페이지 ✓' : '상세페이지 ✕'}</button>
              <button onClick={() => toggleAlways(p)} title="견적 발행 시 후보에 없어도 무조건 추천(최상위 노출)" style={{
                padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-default)',
                background: p.always_recommend ? 'rgba(21,101,52,0.12)' : 'transparent', cursor: 'pointer',
                fontSize: 12, color: p.always_recommend ? '#166534' : 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap',
              }}>{p.always_recommend ? '무조건 추천 ✓' : '무조건 추천 ✕'}</button>
              <button onClick={() => toggle(p)} style={{
                padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-default)',
                background: p.active ? 'var(--promo-bg)' : 'transparent', cursor: 'pointer',
                fontSize: 12, color: p.active ? 'var(--promo)' : 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap',
              }}>{p.active ? '활성' : '비활성'}</button>
              <button onClick={() => remove(p)} style={{
                padding: '5px 10px', borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
              }}>삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
