'use client';

// 인트로 — 화이트 쇼룸의 병 한 병 + 카피 + "밀어서 시작" 슬라이더. 상단에서 매장 선택(바텀시트).
import { useEffect, useRef, useState } from 'react';
import { STORES } from '../lib/quiz';

/** 밀어서 시작 — 노브를 끝까지 밀면 시작. 짧은 탭이면 자동으로 밀리며 시작(발견성 보완). */
function SlideToStart({ onStart }: { onStart: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, x: 0, max: 0, active: false, moved: false });
  const [done, setDone] = useState(false);

  const setX = (x: number, animate: boolean) => {
    const k = knobRef.current; if (!k) return;
    k.style.transition = animate ? 'transform .45s cubic-bezier(0.32,0.72,0,1)' : 'none';
    k.style.transform = `translateX(${x}px)`;
    if (trackRef.current) trackRef.current.style.setProperty('--p', String(drag.current.max ? x / drag.current.max : 0));
  };
  const finish = () => {
    if (done) return;
    setDone(true);
    setX(drag.current.max, true);
    setTimeout(onStart, 320);
  };
  const onDown = (e: React.PointerEvent) => {
    if (done || !trackRef.current || !knobRef.current) return;
    drag.current.max = trackRef.current.clientWidth - knobRef.current.clientWidth - 8;
    drag.current.startX = e.clientX - drag.current.x;
    drag.current.active = true; drag.current.moved = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active || done) return;
    const x = Math.max(0, Math.min(drag.current.max, e.clientX - drag.current.startX));
    if (Math.abs(x - drag.current.x) > 2) drag.current.moved = true;
    drag.current.x = x;
    setX(x, false);
    if (x >= drag.current.max * 0.92) { drag.current.active = false; finish(); }
  };
  const onUp = () => {
    if (!drag.current.active || done) return;
    drag.current.active = false;
    if (!drag.current.moved) { finish(); return; } // 탭 → 자동 슬라이드 시작
    drag.current.x = 0;
    setX(0, true); // 못 미치면 스프링 백
  };

  return (
    <div ref={trackRef} className={`som-slide${done ? ' done' : ''}`} role="button" tabIndex={0}
      aria-label="밀어서 문답 시작"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') finish(); }}>
      <span className="som-slide-txt">밀어서 시작하기</span>
      <div ref={knobRef} className="som-slide-knob"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        →
      </div>
    </div>
  );
}

export function IntroScreen({ store, poolCount, onStoreChange, onStart }: {
  store: string;
  poolCount: number | null;
  onStoreChange: (s: string) => void;
  onStart: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // 병샷 랜덤 순환 — 매장 재고 와인 중 이미지 있는 것을 셔플로 받아 6초마다 크로스페이드
  type Featured = { code: string; name: string; name_en: string };
  const [items, setItems] = useState<Featured[]>([]);
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    fetch('/api/sommelier/featured').then((r) => r.json())
      .then((j) => { if (Array.isArray(j.items) && j.items.length) setItems(j.items); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setFading(false); }, 450);
    }, 6000);
    return () => clearInterval(t);
  }, [items]);
  // 다음 병샷 미리 로드(전환 시 깜빡임 방지)
  useEffect(() => {
    if (items.length < 2) return;
    const next = new Image();
    next.src = `/api/sales/wine-img?code=${encodeURIComponent(items[(idx + 1) % items.length].code)}`;
  }, [items, idx]);
  const cur = items[idx] || null;
  const heroSrc = cur
    ? `/api/sales/wine-img?code=${encodeURIComponent(cur.code)}`
    : '/sommelier/hero.png';

  return (
    <section className="som-screen">
      <div className="som-brand som-rise" style={{ ['--i' as string]: 0 }}>
        <span className="som-lat">CAVE DE VIN</span>
        <button className="som-store" onClick={() => setSheetOpen(true)}>{STORES[store] || '매장 선택'}</button>
      </div>

      <div className="som-vitrine som-rise" style={{ ['--i' as string]: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className={fading ? 'som-hero-fade' : ''}
          onError={() => { if (items.length > 1) setIdx((i) => (i + 1) % items.length); }} />
        <div className="som-floor" />
      </div>

      <div className="som-plate">
        <div className={`som-caption${fading ? ' som-hero-fade' : ''}`}>
          {cur && <>
            <span className="som-cap-kr">{cur.name}</span>
            {cur.name_en && <span className="som-cap-en som-lat">{cur.name_en}</span>}
          </>}
        </div>
        <div className="som-no som-lat som-rise" style={{ ['--i' as string]: 2 }}>
          CAVE DE VIN — WINE SELECTION
        </div>
        <div className="som-rise" style={{ ['--i' as string]: 3 }}>
          <SlideToStart onStart={onStart} />
        </div>
      </div>

      {sheetOpen && (
        <>
          <div className="som-sheet-dim" onClick={() => setSheetOpen(false)} />
          <div className="som-sheet">
            <h3>매장 선택</h3>
            {Object.entries(STORES).map(([key, label]) => (
              <button key={key} className={store === key ? 'sel' : ''}
                onClick={() => { onStoreChange(key); setSheetOpen(false); }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
