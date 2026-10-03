'use client';

// 고객 정보(성함·핸드폰) — 밑줄 입력 + 동의. 핸드폰 기준 upsert로 재방문 이력 누적.
import { RoundBackButton } from '@/app/components/RoundBackButton';
import { SommelierMenu } from './SommelierMenu';
import { useEffect, useState } from 'react';
import { normalizePhone } from '../lib/quiz';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';

export function CustomerScreen({ onDone, onStock, onBack, onHome }: {
  // c=null: 정보 수집 미동의 — 추천·재고 안내는 그대로, 이력만 저장 안 함(개인정보보호법 §16③)
  onDone: (c: SommelierCustomer | null) => void;
  onStock: (c: SommelierCustomer | null) => void; // 기존 재고에서 선택 → 매장 재고(POS)로
  onBack: () => void;
  onHome: () => void; // 로고 → 매장 앱 메인(인트로)
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [marketing, setMarketing] = useState(false); // [선택] 광고성 정보 수신 동의
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 재방문 고객 — 입력 중 조용히 검색해 골드 도트 한 줄로 제안, 탭하면 선택 상태로
  const [matches, setMatches] = useState<SommelierCustomer[]>([]);
  // 선택된 재방문 고객 — API가 번호를 마스킹해 주므로 폼 재입력 대신 객체를 그대로 쓴다
  const [picked, setPicked] = useState<SommelierCustomer | null>(null);

  // 성함이 정확히 같은 손님(동명이인)만 조회. 번호를 4자리 이상 넣으면 그 번호로 더 좁힘
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  const nm = name.trim();
  const query = nm.length >= 2
    ? `name=${encodeURIComponent(nm)}${phoneDigits.length >= 4 ? `&phone=${phoneDigits}` : ''}`
    : '';
  useEffect(() => {
    if (!query) { setMatches([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/sommelier/customer?${query}`)
        .then((r) => r.json())
        .then((j) => setMatches(Array.isArray(j.customers) ? j.customers : []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const maskPhone = (p: string) =>
    p.length >= 8 ? `${p.slice(0, 3)}-····-${p.slice(-4)}` : p;

  // 동의했으면 성함·번호가 유효해야 등록 진행. 미동의면 익명으로 진행(입력값은 저장하지 않음).
  const fieldsOk = name.trim().length >= 2 && !!normalizePhone(phone);
  const valid = !!picked || !agreed || fieldsOk;
  const anonymous = !picked && !agreed;

  // 등록 후 분기 — quiz: 맞춤 추천(취향 문답)으로, stock: 기존 재고에서 선택(매장 재고로)
  const submit = async (mode: 'quiz' | 'stock' = 'quiz') => {
    if (!valid || loading) return;
    if (anonymous) { (mode === 'stock' ? onStock : onDone)(null); return; }
    // 재방문 선택 시 재등록 없이 그대로 진행
    if (picked) { (mode === 'stock' ? onStock : onDone)(picked); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/sommelier/customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, marketing }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '등록에 실패했습니다');
      (mode === 'stock' ? onStock : onDone)(j.customer);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="som-screen">
      <div className="som-brand"><button type="button" className="som-lat som-home" onClick={onHome} aria-label="매장 앱 메인으로">CAVE DE VIN</button><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>취향 문답<SommelierMenu /></span></div>
      <div className="som-prog"><i style={{ width: '8%' }} /></div>
      <div className="som-q">
        <div className="som-qno som-lat som-rise" style={{ ['--i' as string]: 0 }}>GUEST</div>

        {/* 문답 챕터와 같은 뼈대 — 콘텐츠는 중앙, 컨트롤은 바닥 고정 */}
        <div className="som-mid som-rise" style={{ ['--i' as string]: 1 }}>
          <div className="som-field">
            <label>성함</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setPicked(null); }} maxLength={30} />
          </div>
          <div className="som-field">
            <label>핸드폰 번호</label>
            <input value={phone} onChange={(e) => { setPhone(e.target.value); setPicked(null); }}
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
          {/* 재방문 손님을 골랐으면 — 단골 카드(방문·구매·취향·메모)로 */}
          {picked && (
            <a href={`/store/customer/${picked.id}?from=sommelier`}
              style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, color: 'var(--som-muted)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
              {picked.name} 님 단골 카드 보기 →
            </a>
          )}

          {matches.length > 0 && (
            <div className="som-returning">
              {matches.map((m) => (
                <button key={m.id} onClick={() => {
                  // 재방문도 분기(추천/재고)를 타야 하므로 고객을 선택 상태로만 잡는다
                  setPicked(m); setName(m.name); setPhone(maskPhone(m.phone)); setMatches([]);
                }}>
                  <i />{m.name} · {maskPhone(m.phone)} <em>재방문 — 탭하여 선택</em>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="som-anyrow" />
        {anonymous && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--som-muted)', margin: '0 0 10px' }}>
            동의하지 않으면 정보를 저장하지 않고 추천만 진행해요
          </div>
        )}
        <div className="som-subrow som-rise" style={{ ['--i' as string]: 3 }}>
          <RoundBackButton onClick={onBack} label="이전" style={{ boxShadow: "0 4px 10px -4px rgba(0,0,0,0.18)" }} />
          <span style={{ display: 'flex', gap: 10 }}>
            <button className="som-next som-ghost" onClick={() => void submit('stock')} disabled={!valid || loading}
              style={{ opacity: valid ? 1 : 0.45 }}>
              재고에서 선택
            </button>
            <button className="som-next" onClick={() => void submit('quiz')} disabled={!valid || loading}
              style={{ opacity: valid ? 1 : 0.45 }}>
              {loading ? '등록 중…' : '맞춤 추천'}
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}
