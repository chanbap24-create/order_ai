'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// 페이지 부팅 커튼 — 섹션이 순차적으로 튀며 나타나는 대신, 초기 로딩을 커튼으로 덮고
// 등록된 로딩이 모두 끝나면 페이드로 한 번에 공개. 이후엔 다시 나타나지 않음(탭 전환은 스켈레톤).
// 사용: 페이지를 <LoadGateProvider>로 감싸고, 초기 데이터 훅에서 useLoadGate('키', loading) 한 줄.

const GRACE_MS = 400;    // 등록이 늦게 붙는 것 대기 (마운트 직후 fetch 시작 전 공백)
const MAX_WAIT_MS = 5000; // 안전장치 — 이 이상은 그냥 공개 (느린 요청 하나가 전체를 막지 않게)
const FADE_MS = 280;

type Ctx = { register: (id: string, loading: boolean) => void };
const LoadGateCtx = createContext<Ctx | null>(null);

export function LoadGateProvider({ children, label = 'CAVE DE VIN' }: { children: React.ReactNode; label?: string }) {
  const flagsRef = useRef(new Map<string, boolean>());
  const [revealed, setRevealed] = useState(false);
  const [fading, setFading] = useState(false);
  const revealedRef = useRef(false);
  const mountAtRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setFading(true);
    setTimeout(() => setRevealed(true), FADE_MS);
  }, []);

  const check = useCallback(() => {
    if (revealedRef.current) return;
    const anyLoading = [...flagsRef.current.values()].some(Boolean);
    const elapsed = Date.now() - mountAtRef.current;
    if (!anyLoading && elapsed >= GRACE_MS) { startReveal(); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    // grace 이전이면 grace 끝에 재확인, 로딩 중이면 max-wait 안전장치만 대기
    timerRef.current = setTimeout(check, anyLoading ? Math.max(0, MAX_WAIT_MS - elapsed) : GRACE_MS - elapsed + 10);
    if (elapsed >= MAX_WAIT_MS) startReveal();
  }, [startReveal]);

  const register = useCallback((id: string, loading: boolean) => {
    flagsRef.current.set(id, loading);
    check();
  }, [check]);

  useEffect(() => {
    check();
    const failsafe = setTimeout(startReveal, MAX_WAIT_MS);
    return () => { clearTimeout(failsafe); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [check, startReveal]);

  return (
    <LoadGateCtx.Provider value={{ register }}>
      {children}
      {!revealed && (
        <div
          aria-hidden
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
            pointerEvents: fading ? 'none' : 'auto',
          }}
        >
          {/* 소믈리에 부팅 커튼(.som-boot)과 동일 문법 — 워드마크 펄스 + 골드 헤어라인 스위프 */}
          <span style={{
            fontSize: 15, letterSpacing: '0.34em', color: '#221c16',
            animation: 'loadgate-pulse 2.2s ease-in-out infinite',
          }}>
            {label}
          </span>
          <i style={{
            width: 150, height: 1, position: 'relative', overflow: 'hidden',
            background: 'color-mix(in srgb, #b89a6a 22%, transparent)',
          }}>
            <span style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%',
              background: '#b89a6a', animation: 'loadgate-bar 1.4s ease-in-out infinite',
            }} />
          </i>
          <style>{`
            @keyframes loadgate-bar { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
            @keyframes loadgate-pulse { 0%, 100% { opacity: .5 } 50% { opacity: 1 } }
            @media (prefers-reduced-motion: reduce) { .loadgate-anim { animation: none } }
          `}</style>
        </div>
      )}
    </LoadGateCtx.Provider>
  );
}

/** 초기 로딩 플래그 등록 — Provider 밖에서 쓰면 no-op */
export function useLoadGate(id: string, loading: boolean) {
  const ctx = useContext(LoadGateCtx);
  useEffect(() => { ctx?.register(id, loading); }, [ctx, id, loading]);
  // 언마운트 = 해당 로딩 종료로 간주 (탭 전환으로 사라진 컴포넌트가 커튼을 붙잡지 않게)
  useEffect(() => () => ctx?.register(id, false), [ctx, id]);
}
