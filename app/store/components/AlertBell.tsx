'use client';

// 입고 알림 벨 — 탭하면 신청/취소 토글. 켤 때: 버튼이 톡 튀고 벨이 흔들리며 골드 물결이 퍼짐.
// 끌 때: 살짝 눌렸다 돌아오며 골드가 빠짐. 진동(지원 기기) 짧게.
import { useState } from 'react';
import { GOLD } from '../brand';

const CSS = `
@keyframes rb-pop { 0% { transform: scale(1) } 35% { transform: scale(.78) } 70% { transform: scale(1.14) } 100% { transform: scale(1) } }
@keyframes rb-press { 0% { transform: scale(1) } 40% { transform: scale(.82) } 100% { transform: scale(1) } }
@keyframes rb-ring { 0%,100% { transform: rotate(0) } 15% { transform: rotate(22deg) } 30% { transform: rotate(-18deg) }
  45% { transform: rotate(12deg) } 60% { transform: rotate(-8deg) } 75% { transform: rotate(4deg) } }
@keyframes rb-ripple { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(2.2); opacity: 0 } }
.rb-bell { position: relative; transition: background-color .25s ease, border-color .25s ease, color .25s ease }
.rb-bell.on.go { animation: rb-pop .45s cubic-bezier(.3,.7,.3,1.4) }
.rb-bell.off.go { animation: rb-press .3s ease-out }
.rb-bell.on.go svg { animation: rb-ring .7s ease-in-out .08s; transform-origin: 50% 15% }
.rb-bell i { position: absolute; inset: -1px; border-radius: 50%; border: 2px solid ${GOLD}; pointer-events: none;
  animation: rb-ripple .6s ease-out forwards }
@media (prefers-reduced-motion: reduce) { .rb-bell, .rb-bell svg, .rb-bell i { animation: none !important } }
`;

export function AlertBell({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [tick, setTick] = useState(0); // 탭할 때마다 애니메이션 재시작용
  return (
    <span role="button" aria-label={on ? '입고 알림 취소' : '입고 알림 신청'} aria-pressed={on}
      key={tick} className={`rb-bell ${on ? 'on' : 'off'}${tick ? ' go' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        try { navigator.vibrate?.(on ? 8 : 15); } catch { /* ignore */ }
        setTick((t) => t + 1);
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        flex: 'none', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
        border: `1px solid ${on ? GOLD : 'var(--border-default)'}`,
        background: on ? GOLD : 'var(--surface)', color: on ? '#fff' : 'var(--text-primary)',
      }}>
      <style>{CSS}</style>
      {tick > 0 && on && <i aria-hidden />}
      <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" /><path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    </span>
  );
}
