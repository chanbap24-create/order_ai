'use client';

// 고객 정보(성함·핸드폰) — 밑줄 입력 + 동의. 핸드폰 기준 upsert로 재방문 이력 누적.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { normalizePhone } from '../lib/quiz';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';

export function CustomerScreen({ onDone, onBack }: {
  onDone: (c: SommelierCustomer) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [marketing, setMarketing] = useState(false); // [선택] 광고성 정보 수신 동의
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 재방문 고객 — 입력 중 조용히 검색해 골드 도트 한 줄로 제안, 탭하면 즉시 문답으로
  const [matches, setMatches] = useState<SommelierCustomer[]>([]);

  const query = (phone.replace(/[^0-9]/g, '').length >= 3 ? phone : name).trim();
  useEffect(() => {
    if (query.length < 2) { setMatches([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/sommelier/customer?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((j) => setMatches(Array.isArray(j.customers) ? j.customers : []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const maskPhone = (p: string) =>
    p.length >= 8 ? `${p.slice(0, 3)}-····-${p.slice(-4)}` : p;

  const valid = name.trim().length >= 2 && !!normalizePhone(phone) && agreed;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/sommelier/customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, marketing }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '등록에 실패했습니다');
      onDone(j.customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="som-screen">
      <div className="som-brand"><Link className="som-lat" href="/" aria-label="메인으로">CAVE DE VIN</Link><span>취향 문답</span></div>
      <div className="som-prog"><i style={{ width: '8%' }} /></div>
      <div className="som-q">
        <div className="som-qno som-lat som-rise" style={{ ['--i' as string]: 0 }}>GUEST</div>

        {/* 문답 챕터와 같은 뼈대 — 콘텐츠는 중앙, 컨트롤은 바닥 고정 */}
        <div className="som-mid som-rise" style={{ ['--i' as string]: 1 }}>
          <div className="som-field">
            <label>성함</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </div>
          <div className="som-field">
            <label>핸드폰 번호</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              type="tel" inputMode="tel" maxLength={13} />
          </div>
          {/* 개인정보보호법 제15조② 필수 고지: 목적·항목·보유기간·거부권 / 제22조: 마케팅은 선택 동의 분리 */}
          <label className="som-consent">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span><b>[필수]</b> 와인 추천 및 재방문 응대를 위해 성함·연락처를 수집·이용하는 데 동의합니다.
              보유기간: 마지막 방문일로부터 3년 또는 동의 철회 시까지.
              동의를 거부하실 수 있으나, 거부 시 추천 이력 서비스는 이용하실 수 없습니다.</span>
          </label>
          <label className="som-consent">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span><b>[선택]</b> 신상품·행사 등 광고성 정보 수신(문자)에 동의합니다.</span>
          </label>
          {error && <div className="som-err">{error}</div>}

          {matches.length > 0 && (
            <div className="som-returning">
              {matches.map((m) => (
                <button key={m.id} onClick={() => onDone(m)}>
                  <i />{m.name} · {maskPhone(m.phone)} <em>재방문 — 바로 시작</em>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="som-anyrow" />
        <div className="som-subrow som-rise" style={{ ['--i' as string]: 3 }}>
          <button className="som-link" onClick={onBack}>이전</button>
          <button className="som-next" onClick={submit} disabled={!valid || loading}
            style={{ opacity: valid ? 1 : 0.45 }}>
            {loading ? '등록 중…' : '문답으로'}
          </button>
        </div>
      </div>
    </section>
  );
}
