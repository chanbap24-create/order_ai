'use client';

// 소믈리에 화면 공용 애니메이션 — transform/opacity만 사용(GPU), reduced-motion 존중.
export function SommelierStyles() {
  return (
    <style>{`
@keyframes som-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes som-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes som-pour {
  0% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-4px) rotate(-8deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
.som-up {
  animation: som-fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
.som-in {
  animation: som-fade 0.5s ease both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
.som-chip {
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.som-chip:active { transform: scale(0.97); }
.som-chip:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.som-cta {
  transition: background 0.18s ease, transform 0.15s ease, opacity 0.18s ease;
}
.som-cta:active { transform: scale(0.98); }
.som-progress {
  transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.som-glass { display: inline-block; animation: som-pour 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .som-up, .som-in, .som-glass { animation: none; }
  .som-chip, .som-cta, .som-progress { transition: none; }
}
    `}</style>
  );
}
