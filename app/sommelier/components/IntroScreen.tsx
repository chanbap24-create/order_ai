'use client';

// 인트로 — 화이트 쇼룸의 병 한 병 + 카피 + 시작 CTA. 상단에서 매장 선택(바텀시트).
import { useState } from 'react';
import { STORES } from '../lib/quiz';

export function IntroScreen({ store, poolCount, onStoreChange, onStart }: {
  store: string;
  poolCount: number | null;
  onStoreChange: (s: string) => void;
  onStart: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="som-screen">
      <div className="som-brand som-rise" style={{ ['--i' as string]: 0 }}>
        <span className="som-lat">CAVE DE VIN</span>
        <button className="som-store" onClick={() => setSheetOpen(true)}>{STORES[store] || '매장 선택'}</button>
      </div>

      <div className="som-vitrine som-rise" style={{ ['--i' as string]: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sommelier/hero.png" alt="" />
        <div className="som-floor" />
      </div>

      <div className="som-plate">
        <div className="som-no som-lat som-rise" style={{ ['--i' as string]: 2 }}>
          SELECTION{poolCount ? ` ${poolCount}` : ''}
        </div>
        <h1 className="som-rise" style={{ ['--i' as string]: 3 }}>
          오늘 이 자리에 어울리는<br />한 병을 찾아드립니다
        </h1>
        <p className="som-rise" style={{ ['--i' as string]: 4 }}>
          와인을 몰라도 괜찮습니다.<br />다섯 번의 취향 문답이면 충분합니다.
        </p>
        <button className="som-cta som-rise" style={{ ['--i' as string]: 5 }} onClick={onStart}>
          문답 시작하기 <i>→</i>
        </button>
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
