'use client';

// 추천 결과 — 화이트 쇼룸 카드 레일. 구조 프로파일 4종(무게감·당도·산미·탄닌) 바 +
// [구매 기록]으로 고객 이력 저장(향후 자동추천 학습 데이터).
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';
import { DetailOverlay } from './DetailOverlay';
import { BODY_OPTIONS, PRICE_OPTIONS, TYPE_OPTIONS, type QuizAnswers } from '../lib/quiz';

const won = (n: number) => n.toLocaleString('ko-KR');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

function summary(a: QuizAnswers | null): string {
  if (!a) return '';
  const parts: string[] = [];
  const t = TYPE_OPTIONS.find((o) => o.value === a.type);
  if (t?.value) parts.push(t.label);
  const b = BODY_OPTIONS.find((o) => o.value === a.body);
  if (b?.value) parts.push(b.label);
  const p = PRICE_OPTIONS.find((o) => o.min === a.priceMin && o.max === a.priceMax);
  if (p && (p.min != null || p.max != null)) parts.push(p.label);
  return parts.join(' · ');
}

export function ResultsScreen({ customerName, customerId, sessionId, answers, results, priceHint, onBack, onRetry, onNewGuest }: {
  customerName: string;
  customerId: number | null;
  sessionId: number | null;
  answers: QuizAnswers | null;
  results: SommelierResult[];
  priceHint?: { count: number; minPrice: number } | null;
  onBack: () => void;   // 문답 마지막 질문으로(답변 유지)
  onRetry: () => void;  // 처음부터 다시 문답
  onNewGuest: () => void;
}) {
  const [ordered, setOrdered] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(5); // 5병씩 더보기
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null); // 전체화면 상세로 연 카드 인덱스
  const shown = results.slice(0, visible);
  // 데스크탑 좌우 화살표 + 마우스 드래그 스와이프
  const [edge, setEdge] = useState({ l: false, r: false });
  const dragMoved = useRef(false); // 드래그 직후 클릭(상세 열림) 오발 방지

  // 모바일 스크롤 스포트라이트 — 중앙 스냅 카드가 조명을 받고 양옆은 흐려짐 + 페이지 점
  const railRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || shown.length === 0) return;
    const touch = window.matchMedia('(hover: none)').matches;
    if (!touch) return; // 데스크탑은 호버 스포트라이트가 담당
    setSpot(true);
    let raf = 0;
    const update = () => {
      raf = 0;
      // 스냅 중심에 가장 가까운 카드 인덱스만 계산 — 크기·위치는 건드리지 않아 상하 고정
      const center = rail.scrollLeft + rail.clientWidth / 2;
      const cards = Array.from(rail.children) as HTMLElement[];
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const cc = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cc - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      setPage(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    rail.addEventListener('scroll', onScroll, { passive: true });
    return () => { rail.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, visible]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const upd = () => setEdge({
      l: rail.scrollLeft > 4,
      r: rail.scrollLeft < rail.scrollWidth - rail.clientWidth - 4,
    });
    upd();
    rail.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    return () => { rail.removeEventListener('scroll', upd); window.removeEventListener('resize', upd); };
  }, [results, visible]);

  // 마우스 드래그로 레일 넘기기 — 드래그 중엔 스냅을 꺼서 저항 없이 끌리게
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || window.matchMedia('(hover: none)').matches) return;
    let down = false, startX = 0, startLeft = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      down = true; dragMoved.current = false;
      startX = e.clientX; startLeft = rail.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6 && !dragMoved.current) {
        dragMoved.current = true;
        rail.style.scrollSnapType = 'none';
      }
      if (dragMoved.current) { rail.scrollLeft = startLeft - dx; e.preventDefault(); }
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      rail.style.scrollSnapType = '';
      // click 이벤트가 pointerup 뒤에 오므로 한 틱 뒤에 해제
      setTimeout(() => { dragMoved.current = false; }, 50);
    };
    rail.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      rail.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [results, visible]);

  const nudge = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector('.som-card') as HTMLElement | null;
    rail.scrollBy({ left: dir * ((card?.offsetWidth || 320) + 16), behavior: 'smooth' });
  };

  const goPage = (i: number) => {
    const rail = railRef.current;
    const card = rail?.children[i] as HTMLElement | undefined;
    if (!rail || !card) return;
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  /** 구매 기록 토글 — 기록/재탭 시 취소(DB에서도 삭제) */
  const order = async (r: SommelierResult) => {
    if (!customerId || busy) return;
    const cancel = ordered.has(r.item_code);
    setBusy(r.item_code);
    try {
      const res = await fetch('/api/sommelier/order', {
        method: cancel ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId, sessionId, itemCode: r.item_code, itemName: r.name,
          retailPrice: r.retail_price, quantity: 1,
        }),
      });
      if (res.ok) {
        setOrdered((s) => {
          const n = new Set(s);
          if (cancel) n.delete(r.item_code); else n.add(r.item_code);
          return n;
        });
      } else alert(cancel ? '취소에 실패했습니다.' : '구매 기록에 실패했습니다.');
    } catch { alert('처리에 실패했습니다.'); }
    finally { setBusy(null); }
  };

  return (
    <section className="som-screen som-results">
      <div className="som-head">
        <div className="som-brand"><Link className="som-lat" href="/" aria-label="메인으로">CAVE DE VIN</Link><span>추천 결과</span></div>
        <div className="som-prog"><i style={{ width: '100%' }} /></div>
        <h2 className="som-rise som-lat" style={{ ['--i' as string]: 0 }}>
          Your Selection
        </h2>
        <p className="som-sum som-rise" style={{ ['--i' as string]: 1 }}>
          {[summary(answers), `${shown.length} bottles`].filter(Boolean).join(' · ')}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="som-empty som-rise" style={{ ['--i' as string]: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>조건에 맞는 와인을 찾지 못했어요</div>
          {priceHint ? (
            <div style={{ fontSize: 13, color: 'var(--som-muted)' }}>
              같은 취향으로 가격대를 넓히면 <b style={{ color: 'var(--som-stain)' }}>{priceHint.count}병</b>이 있어요
              (최저 {priceHint.minPrice.toLocaleString('ko-KR')}원)
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--som-muted)' }}>가격대나 타입을 넓혀 다시 찾아볼까요?</div>
          )}
          <button className="som-next" style={{ marginTop: 14 }} onClick={onBack}>← 이전으로</button>
        </div>
      ) : (
        <div className="som-railwrap">
        <div className={`som-rail${spot ? ' spotmode' : ''}`} ref={railRef}>
          {shown.map((r, i) => {
            const done = ordered.has(r.item_code);
            return (
              <div key={r.item_code}
                className={`som-card som-rise${spot ? (i === page ? ' focus' : ' dim') : ''}`}
                style={{ ['--i' as string]: Math.min(i, 6) + 2, cursor: 'pointer' }}
                onClick={() => { if (!dragMoved.current) setDetail(i); }}>
                <div className="som-core">
                  <div className="som-shot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/sales/wine-img?code=${encodeURIComponent(r.item_code)}${r.img_ver ? `&v=${r.img_ver}` : ''}`} alt={r.name}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                  </div>
                  <div className="som-cardfloor" />
                  <div className="som-rank som-lat">NO. {ROMAN[i] || i + 1}</div>
                  <div className="som-nm">{r.name}</div>
                  {r.name_en && (
                    <div className="som-en som-lat">{[r.name_en, r.vintage].filter(Boolean).join(' ')}</div>
                  )}
                  <div className="som-bars">
                    <div className="som-bar"><b>무게감</b><div className="tr"><i style={{ ['--v' as string]: r.body }} /></div></div>
                    <div className="som-bar"><b>당도</b><div className="tr"><i style={{ ['--v' as string]: r.sweetness }} /></div></div>
                    <div className="som-bar"><b>산미</b><div className="tr"><i style={{ ['--v' as string]: r.acidity }} /></div></div>
                    <div className="som-bar"><b>탄닌</b><div className="tr"><i style={{ ['--v' as string]: r.tannin }} /></div></div>
                  </div>
                  <div className="som-reason">{r.reason}</div>
                  <div className="som-pricebox">
                    <span className="som-price">{won(r.retail_price)}원</span>
                    <button className={`som-buy${done ? ' done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); order(r); }}
                      disabled={busy === r.item_code}
                      title={done ? '다시 누르면 취소됩니다' : undefined}>
                      {busy === r.item_code ? '처리 중…' : done ? '✓ 기록됨 · 취소' : '구매 기록'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="som-arrow l" onClick={() => nudge(-1)} disabled={!edge.l} aria-label="이전 와인">‹</button>
        <button className="som-arrow r" onClick={() => nudge(1)} disabled={!edge.r} aria-label="다음 와인">›</button>
        </div>
      )}

      {spot && shown.length > 1 && (
        <div className="som-dots">
          {shown.map((r, i) => (
            <i key={r.item_code} className={i === page ? 'on' : ''} onClick={() => goPage(i)} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
        {visible < results.length && (
          <button className="som-again" style={{ color: 'var(--som-stain)' }}
            onClick={() => setVisible((v) => v + 5)}>
            더보기 · {Math.min(5, results.length - visible)}병
          </button>
        )}
        <button className="som-again" onClick={onBack}>← 이전으로</button>
        <button className="som-again" onClick={onRetry}>처음부터 다시</button>
        <button className="som-again" onClick={onNewGuest}>새 손님 응대</button>
      </div>

      {detail != null && results[detail] && (
        <DetailOverlay r={results[detail]} rank={ROMAN[detail] || String(detail + 1)}
          ordered={ordered.has(results[detail].item_code)}
          busy={busy === results[detail].item_code}
          onOrder={() => order(results[detail])}
          onClose={() => setDetail(null)} />
      )}
    </section>
  );
}
