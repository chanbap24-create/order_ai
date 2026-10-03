'use client';

// 백화점 소믈리에 — 손님과 함께 보는 취향 문답 (화이트 쇼룸, 단독 풀스크린).
// 흐름: 직원 로그인 → 인트로(매장 선택) → 고객 정보 → 문답 5단계 → 추천 → 구매 기록.
import { useEffect, useState } from 'react';
import { LoginCard } from '../sales/page-auth/components/LoginCard';
import { IntroScreen } from './components/IntroScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { QuizFlow } from './components/QuizFlow';
import { ResultsScreen } from './components/ResultsScreen';
import type { QuizAnswers } from './lib/quiz';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';
import { endGuestSession, readGuest, readSommelierView, saveSommelierView, startGuestSession, writeQuizSession } from '@/app/lib/store/cartSession';
import './sommelier.css';

type Phase = 'intro' | 'customer' | 'quiz' | 'results';
type SomView = {
  phase: Phase; customer: SommelierCustomer | null; answers: QuizAnswers | null;
  results: SommelierResult[]; priceHint: { count: number; minPrice: number } | null; sessionId: number | null;
};

export default function SommelierPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [managerList, setManagerList] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>('intro');
  // 매장(보기 범위)·판매 가능 = 로그인 세션 기준(선택·변경 없음). 본사='all'(조회 전용)
  const [store, setStore] = useState('all');
  const [canSell, setCanSell] = useState(false);
  const [customer, setCustomer] = useState<SommelierCustomer | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);
  const [results, setResults] = useState<SommelierResult[]>([]);
  const [priceHint, setPriceHint] = useState<{ count: number; minPrice: number } | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 문답 제출 → 결과 사이 로딩 커튼 (인트로 부팅과 같은 문법, 최소 0.9초 유지)
  const [reading, setReading] = useState<'off' | 'on' | 'out'>('off');
  const [resume, setResume] = useState(false); // 결과→이전: 답변 유지한 채 마지막 질문으로
  const [quizNonce, setQuizNonce] = useState(0);
  // 단골 카드 '이 취향으로 추천' — 로그인 확인 뒤 이 답변으로 바로 추천(문답 생략)
  const [autoAnswers, setAutoAnswers] = useState<QuizAnswers | null>(null);

  useEffect(() => {
    // 매장 재고(POS)에서 넘어온 문답 직행 — 연결된 손님이 있으면 고객 단계 생략
    try {
      const qs = new URLSearchParams(window.location.search);
      const view = qs.get('resume') ? readSommelierView<SomView>() : null;
      if (view) {
        // 재고 앱 '뒤로' — 마지막으로 보던 소믈리에 화면 그대로(손님·답변·추천 결과)
        setCustomer(view.customer); setAnswers(view.answers); setResults(view.results || []);
        setPriceHint(view.priceHint); setSessionId(view.sessionId);
        if (view.phase === 'quiz' && view.answers) setResume(true);
        setPhase(view.phase);
        window.history.replaceState(null, '', '/sommelier');
      } else if (qs.get('auto')) {
        const g = readGuest();
        const a = JSON.parse(sessionStorage.getItem('cave_som_auto') || 'null') as QuizAnswers | null;
        sessionStorage.removeItem('cave_som_auto');
        if (g?.id) setCustomer({ id: g.id, name: g.name || '' } as SommelierCustomer);
        if (a) setAutoAnswers(a); else setPhase('quiz');
        window.history.replaceState(null, '', '/sommelier');
      } else if (qs.get('quiz')) {
        const g = readGuest();
        if (g?.id) {
          setCustomer({ id: g.id, name: g.name || '' } as SommelierCustomer);
          setPhase('quiz');
        } else {
          setPhase('customer'); // 손님 미연결이면 등록부터
        }
        window.history.replaceState(null, '', '/sommelier');
      } else if (!qs.get('resume')) {
        // 그냥 메인(/sommelier)으로 들어옴 — 재고 앱 로고 등. 응대 중이던 손님 해제
        // (resume인데 저장된 화면이 없을 때는 손님 유지 — 재고 앱 '뒤로'로 돌아온 경우)
        endGuestSession();
      }
    } catch { /* ignore */ }
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
      fetch('/api/sales/clients/managers?scope=store').then((r) => r.json()).catch(() => null),
    ]).then(([me, mgr]) => {
      setAuthed(!!me?.authenticated && me?.store === true && !!me?.storeView); // 매장 권한 없는 영업 계정은 로그인 화면
      if (me?.storeView) { setStore(me.storeView); setCanSell(me.canSell === true); }
      setManagerList(Array.isArray(mgr?.managers) ? mgr.managers : []);
      setChecking(false);
    });
  }, []);

  // 마지막 화면 기억 — 재고 앱에서 '뒤로'로 돌아올 때 복원
  useEffect(() => {
    if (checking) return;
    saveSommelierView({ phase, customer, answers, results, priceHint, sessionId } satisfies SomView);
  }, [checking, phase, customer, answers, results, priceHint, sessionId]);


  useEffect(() => {
    if (checking || !authed || !autoAnswers) return;
    const a = autoAnswers;
    const t = setTimeout(() => { setAutoAnswers(null); void submit(a, customer, 'auto'); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, authed, autoAnswers]);

  // who: 방금 지정한 손님(재방문 '지난 취향으로 추천') — state 반영 전이라 직접 넘긴다
  // via='auto': 문답 없이 구매 취향으로 바로 추천 — 이력에서 일반 문답과 구분
  const submit = async (a: QuizAnswers, who: SommelierCustomer | null = customer, via: 'quiz' | 'auto' = 'quiz') => {
    if (submitting) return;
    setSubmitting(true);
    setReading('on');
    const t0 = Date.now();
    try {
      const r = await fetch('/api/sommelier/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: a, customerId: who?.id, store, via }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '추천에 실패했습니다');
      setAnswers(a);
      setSessionId(j.sessionId || null);
      if (who?.id) writeQuizSession(j.sessionId || null); // 정산 구매 기록에 직전 문답 연결
      setResults(j.results || []);
      setPriceHint(j.priceHint || null);
      setTimeout(() => {
        setPhase('results');
        setReading('out');
        setTimeout(() => setReading('off'), 750);
      }, Math.max(0, 900 - (Date.now() - t0)));
    } catch (e) {
      setReading('off');
      alert(e instanceof Error ? e.message : '추천에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 새 손님 응대 — 이전 손님 연결·카트까지 해제해야 다음 구매가 앞 손님에게 기록되지 않는다.
  // 로고(메인으로)도 같은 동작 — 메인으로 나가면 응대 중이던 손님 정보는 해제
  const newGuest = () => {
    endGuestSession();
    setCustomer(null); setAnswers(null); setResults([]); setSessionId(null); setPhase('intro');
  };

  if (checking) {
    return <div className="som-root"><div className="som-center">준비 중…</div></div>;
  }
  if (!authed) {
    return <LoginCard managerList={managerList} scope="store" onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="som-root">
      <div className="som-spot" />
      {phase === 'intro' && (
        <IntroScreen store={store}
          onStart={() => setPhase('customer')} />
      )}
      {phase === 'customer' && (
        <CustomerScreen onBack={() => setPhase('intro')} onHome={newGuest}
          onDone={(c) => {
            // 고객 단계 통과 = 새 손님 응대 시작 (c=null: 정보 미동의 — 추천만, 이력 기록 없음)
            startGuestSession(c ? { id: c.id, name: c.name } : null);
            setCustomer(c); setPhase('quiz');
          }}
          onAuto={(c, a) => {
            // 재방문 '지난 취향으로 추천' — 손님 연결 후 문답 없이 바로 추천
            startGuestSession({ id: c.id, name: c.name });
            setCustomer(c);
            void submit(a, c, 'auto');
          }}
          onStock={(c) => {
            // 기존 재고에서 선택 — 매장 재고(POS)로, 매장·고객을 함께 넘긴다
            // 새 손님 시작이므로 이전 정산 카트는 비운다
            startGuestSession(c ? { id: c.id, name: c.name } : null);
            // 새 손님 시작이 마지막 화면 기억도 지우므로, 재고 앱 '뒤로'가 이 화면으로 오게 다시 기억
            saveSommelierView({ phase: 'customer', customer: c, answers: null, results: [], priceHint: null, sessionId: null } satisfies SomView);
            window.location.href = '/store';
          }} />
      )}
      {phase === 'quiz' && (
        <QuizFlow key={quizNonce} onSubmit={submit} submitting={submitting} onHome={newGuest}
          onExit={() => setPhase('customer')}
          initialAnswers={resume ? answers : null} initialStep={resume ? 4 : 0} />
      )}
      {reading !== 'off' && (
        <div className={`som-boot${reading === 'out' ? ' out' : ''}`} aria-hidden>
          <span className="som-lat">CAVE DE VIN</span>
          <i />
          <em>{customer?.name || '손님'} 님의 취향에 맞는 와인을 고르는 중</em>
        </div>
      )}
      {phase === 'results' && (
        <ResultsScreen onHome={newGuest} canSell={canSell} store={store}
          customerName={customer?.name || '손님'}
          customerId={customer?.id ?? null}
          sessionId={sessionId}
          answers={answers}
          results={results}
          priceHint={priceHint}
          onBack={() => { setResume(true); setQuizNonce((n) => n + 1); setPhase('quiz'); }}
          onRetry={() => { setResume(false); setQuizNonce((n) => n + 1); setPhase('quiz'); }}
          onNewGuest={newGuest}
        />
      )}
    </div>
  );
}
