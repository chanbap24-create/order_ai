'use client';

// 소믈리에 백화점 할인율 조정 (MVP) — 권한자(박경아·조성재, admin)만 수정 가능.
// 가격대(정상가 기준) 밴드별 할인율 %를 설정하면 소믈리에 카드가 정상가→할인가로 노출된다.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Band = { id: number; min_price: number; max_price: number | null; rate: number };

const won = (n: number) => n.toLocaleString('ko-KR');
const bandLabel = (b: Band) => {
  if (b.min_price <= 0) return `${won(b.max_price || 0)}원 미만`;
  if (b.max_price == null) return `${won(b.min_price)}원 이상`;
  return `${won(b.min_price)} ~ ${won(b.max_price)}원`;
};

export default function SommelierPricingPage() {
  const router = useRouter();
  const [bands, setBands] = useState<Band[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [manager, setManager] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/sommelier/discounts')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setBands(d.bands); setCanEdit(d.canEdit); setManager(d.manager || ''); }
        else setErr(d.error || '불러오기 실패');
      })
      .catch(() => setErr('불러오기 실패'))
      .finally(() => setLoading(false));
  }, []);

  const setRate = (id: number, v: string) => {
    const rate = Math.max(0, Math.min(70, Number(v) || 0));
    setBands((prev) => prev.map((b) => (b.id === id ? { ...b, rate } : b)));
    setMsg('');
  };

  const save = async () => {
    setSaving(true); setMsg(''); setErr('');
    try {
      const res = await fetch('/api/sommelier/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bands: bands.map((b) => ({ id: b.id, rate: b.rate })) }),
      });
      const d = await res.json();
      if (d.success) { setBands(d.bands); setMsg('저장되었습니다. 소믈리에 추천에 바로 적용됩니다.'); }
      else setErr(d.error || '저장 실패');
    } catch { setErr('저장 실패'); }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px', fontSize: 14, color: 'var(--text-primary, #111)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>백화점 할인율</h1>
        <button onClick={() => router.back()}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: 'var(--text-tertiary, #888)' }}>
          ← 뒤로
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', margin: '0 0 20px', wordBreak: 'keep-all' }}>
        정상가 기준 가격대별 할인율입니다. 저장하면 소믈리에 추천 카드에 정상가와 할인가가 함께 표시됩니다.
      </p>

      {loading ? (
        <div style={{ padding: '32px 0', color: 'var(--text-tertiary, #888)', fontSize: 13 }}>불러오는 중</div>
      ) : (
        <>
          {!canEdit && (
            <div style={{ padding: '10px 0 14px', fontSize: 12.5, color: 'var(--status-warning, #b45309)' }}>
              조회 전용입니다. 할인율 조정은 박경아 부장·조성재 차장 계정만 가능합니다. (현재: {manager})
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border-default, #e5e5e5)' }}>
            {bands.map((b) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 2px', borderBottom: '1px solid var(--border-subtle, #eee)',
              }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{bandLabel(b)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" inputMode="numeric" min={0} max={70} step={1}
                    value={b.rate} disabled={!canEdit}
                    onChange={(e) => setRate(b.id, e.target.value)}
                    style={{
                      width: 72, padding: '8px 10px', fontSize: 16, textAlign: 'right',
                      border: '1px solid var(--border-default, #ddd)', borderRadius: 8,
                      fontVariantNumeric: 'tabular-nums', background: canEdit ? '#fff' : 'var(--surface-muted, #f7f7f7)',
                    }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary, #555)', width: 30 }}>% 할인</span>
                </span>
              </div>
            ))}
          </div>

          {canEdit && (
            <button
              onClick={save} disabled={saving}
              style={{
                marginTop: 20, width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700,
                background: 'var(--action, #111)', color: '#fff', border: 'none', borderRadius: 10,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          )}
          {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--status-success, #15803d)' }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--status-danger, #b91c1c)' }}>{err}</div>}

          <div style={{ marginTop: 28, fontSize: 11.5, color: 'var(--text-tertiary, #999)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            · 할인가는 100원 단위 내림으로 계산됩니다.<br />
            · 0%로 두면 해당 가격대는 정상가 그대로 노출됩니다.<br />
            · 손님 예산 필터도 할인가 기준으로 매칭됩니다.
          </div>
        </>
      )}
    </div>
  );
}
