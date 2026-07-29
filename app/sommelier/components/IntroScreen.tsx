'use client';

// 인트로 — 화이트 쇼룸의 병 한 병 + 카피 + "밀어서 시작" 슬라이더. 상단에서 매장 선택(바텀시트).
import Link from 'next/link';
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

export function IntroScreen({ store, onStoreChange, onStart }: {
  store: string;
  onStoreChange: (s: string) => void;
  onStart: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  // 부팅 로딩 — 첫 병샷이 준비되면(또는 5초 타임아웃) 걷어내고 본문이 떠오른다
  const [boot, setBoot] = useState<'on' | 'out' | 'off'>('on');

  // 병샷 랜덤 순환 — 후보를 백그라운드에서 미리 로드해 성공한 이미지만 화면에 올린다
  // (로드 실패 후보를 화면에서 스킵하며 여러 장이 빠르게 지나가던 문제 방지)
  type Featured = { code: string; name: string; name_en: string; v?: string };
  const [items, setItems] = useState<Featured[]>([]);
  const [display, setDisplay] = useState<{ src: string; cur: Featured | null }>({ src: '', cur: null });
  const [fading, setFading] = useState(false);
  const idxRef = useRef(0);
  const busyRef = useRef(false); // 전환 중 중복 로드 방지(느린 로딩 시 순서 꼬임 가드)
  const imgUrl = (it: Featured) => `/api/sales/wine-img?code=${encodeURIComponent(it.code)}${it.v ? `&v=${it.v}` : ''}`;

  useEffect(() => {
    // 매장 바꾸면 그 매장 재고 있는 와인으로 다시 뽑음
    fetch(`/api/sommelier/featured?store=${encodeURIComponent(store)}`).then((r) => r.json())
      .then((j) => setItems(Array.isArray(j.items) ? j.items : []))
      .catch(() => {});
  }, [store]);

  useEffect(() => {
    if (items.length === 0) return;
    let alive = true;
    const show = (i: number, attempts = 0) => {
      if (!alive || attempts >= items.length) { busyRef.current = false; return; }
      busyRef.current = true;
      const it = items[i % items.length];
      const src = imgUrl(it);
      const im = new Image();
      im.onload = () => {
        if (!alive) return;
        idxRef.current = i % items.length;
        setFading(true);
        setTimeout(() => {
          if (!alive) return;
          setDisplay({ src, cur: it });
          setFading(false);
          busyRef.current = false;
        }, 450);
      };
      im.onerror = () => show(i + 1, attempts + 1); // 실패 후보는 화면에 안 올리고 조용히 스킵
      im.src = src;
    };
    show(0);
    // 다음 병샷 2장 예열 — 첫 순환 전환이 대기 없이 되도록
    for (const it of items.slice(1, 3)) { const w = new Image(); w.src = imgUrl(it); }
    const t = setInterval(() => { if (!busyRef.current) show(idxRef.current + 1); }, 6000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const cur = display.cur;
  const heroSrc = display.src; // 폴백 이미지 없음 — 이름 있는 와인만 표시(첫 병이 무명으로 보이던 문제)

  useEffect(() => {
    if (boot === 'on' && display.cur) setBoot('out');
  }, [display.cur, boot]);
  useEffect(() => {
    if (boot !== 'out') return;
    const t = setTimeout(() => setBoot('off'), 750);
    return () => clearTimeout(t);
  }, [boot]);
  useEffect(() => {
    // 이미지가 하나도 준비 못 되는 경우(빈 재고 등)에도 페이지가 잠기지 않게
    const t = setTimeout(() => setBoot((b) => (b === 'on' ? 'out' : b)), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="som-screen">
      {boot !== 'off' && (
        <div className={`som-boot${boot === 'out' ? ' out' : ''}`} aria-hidden>
          <span className="som-lat">CAVE DE VIN</span>
          <i />
        </div>
      )}
      {boot !== 'on' && <>
      <div className="som-brand som-rise" style={{ ['--i' as string]: 0 }}>
        <Link className="som-lat" href="/" aria-label="메인으로">CAVE DE VIN</Link>
        <button className="som-store" onClick={() => setSheetOpen(true)}>{STORES[store] || '매장 선택'}</button>
      </div>

      <div className="som-vitrine som-rise" style={{ ['--i' as string]: 1 }}>
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroSrc} alt="" className={fading ? 'som-hero-fade' : ''} />
        ) : (
          <div style={{ height: 'min(48vh,460px)' }} aria-hidden />
        )}
        <div className="som-floor" />
      </div>

      <div className="som-plate">
        {/* key로 와인마다 새 노드 — 텍스트 교체 잔상(이전·새 이름 겹침) 방지 */}
        <div key={cur?.code || 'none'} className={`som-caption${fading ? ' som-hero-fade' : ''}`}>
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
      </>}
    </section>
  );
}
