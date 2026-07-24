'use client';

// 웰컴 + 고객 정보(성함·핸드폰) 입력 — 손님과 함께 보는 첫 화면.
import { useState } from 'react';
import { normalizePhone } from '../lib/quiz';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';

export function CustomerIntro({ onStart }: { onStart: (c: SommelierCustomer) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const valid = name.trim().length >= 2 && !!normalizePhone(phone) && agreed;

  const start = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/sommelier/customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '등록에 실패했습니다');
      onStart(j.customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div className="som-up" style={{ ['--i' as string]: 0, fontSize: 40 }}>
        <span className="som-glass">🍷</span>
      </div>
      <div className="som-up" style={{
        ['--i' as string]: 1,
        fontSize: 12, letterSpacing: '0.35em', color: 'var(--text-muted)', fontWeight: 600, marginTop: 18,
      }}>
        CAVE DE VIN
      </div>
      <h1 className="som-up" style={{
        ['--i' as string]: 2,
        fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 8px', letterSpacing: '-0.02em', lineHeight: 1.35,
      }}>
        취향에 꼭 맞는 와인을<br />찾아드릴게요
      </h1>
      <p className="som-up" style={{ ['--i' as string]: 3, fontSize: 14, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>
        몇 가지 질문에 답하시면<br />저희 셀렉션에서 가장 어울리는 와인을 추천해드려요
      </p>

      <div className="som-up" style={{ ['--i' as string]: 4, maxWidth: 360, margin: '32px auto 0', textAlign: 'left' }}>
        <label style={labelStyle}>성함</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동"
          style={inputStyle} maxLength={30} />
        <label style={{ ...labelStyle, marginTop: 14 }}>핸드폰 번호</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000"
          type="tel" inputMode="tel" style={inputStyle} maxLength={13} />

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, cursor: 'pointer',
          fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55,
        }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: 'var(--action)' }} />
          <span>
            와인 추천과 안내를 위해 성함·연락처를 수집하는 데 동의합니다.
            수집된 정보는 추천 이력 관리 목적으로만 사용됩니다.
          </span>
        </label>

        {error && <div style={{ fontSize: 13, color: 'var(--status-danger)', marginTop: 12 }}>{error}</div>}

        <button onClick={start} disabled={!valid || loading} className="som-cta" style={{
          width: '100%', height: 52, marginTop: 20, borderRadius: 10, border: 'none',
          background: valid ? 'var(--action)' : 'var(--action-muted)',
          color: valid ? 'var(--text-on-primary)' : 'var(--text-muted)',
          fontSize: 15.5, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed',
        }}>
          {loading ? '시작하는 중…' : '취향 찾기 시작'}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: 50, padding: '0 14px', borderRadius: 10, boxSizing: 'border-box',
  border: '1px solid var(--border-default)', fontSize: 16, /* iOS 줌 방지 */
  outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)',
};
