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
import './sommelier.css';

type Phase = 'intro' | 'customer' | 'quiz' | 'results';

export default function SommelierPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [managerList, setManagerList] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [store, setStore] = useState('all');
  const [customer, setCustomer] = useState<SommelierCustomer | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers | null>(null);
  const [results, setResults] = useState<SommelierResult[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resume, setResume] = useState(false); // 결과→이전: 답변 유지한 채 마지막 질문으로
  const [quizNonce, setQuizNonce] = useState(0);

  useEffect(() => {
    try { const s = localStorage.getItem('som_store'); if (s) setStore(s); } catch { /* ignore */ }
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
      fetch('/api/sales/clients/managers').then((r) => r.json()).catch(() => null),
    ]).then(([me, mgr]) => {
      setAuthed(!!me?.authenticated);
      setManagerList(Array.isArray(mgr?.managers) ? mgr.managers : []);
      setChecking(false);
    });
  }, []);

  const changeStore = (s: string) => {
    setStore(s);
    try { localStorage.setItem('som_store', s); } catch { /* ignore */ }
  };

  const submit = async (a: QuizAnswers) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/sommelier/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: a, customerId: customer?.id, store }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '추천에 실패했습니다');
      setAnswers(a);
      setSessionId(j.sessionId || null);
      setResults(j.results || []);
      setPhase('results');
    } catch (e) {
      alert(e instanceof Error ? e.message : '추천에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const newGuest = () => {
    setCustomer(null); setAnswers(null); setResults([]); setSessionId(null); setPhase('intro');
  };

  if (checking) {
    return <div className="som-root"><div className="som-center">준비 중…</div></div>;
  }
  if (!authed) {
    return <LoginCard managerList={managerList} onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="som-root">
      <div className="som-spot" />
      {phase === 'intro' && (
        <IntroScreen store={store} poolCount={null} onStoreChange={changeStore}
          onStart={() => setPhase('customer')} />
      )}
      {phase === 'customer' && (
        <CustomerScreen onBack={() => setPhase('intro')}
          onDone={(c) => { setCustomer(c); setPhase('quiz'); }} />
      )}
      {phase === 'quiz' && (
        <QuizFlow key={quizNonce} onSubmit={submit} submitting={submitting}
          onExit={() => setPhase('customer')}
          initialAnswers={resume ? answers : null} initialStep={resume ? 4 : 0} />
      )}
      {phase === 'results' && (
        <ResultsScreen
          customerName={customer?.name || '손님'}
          customerId={customer?.id ?? null}
          sessionId={sessionId}
          answers={answers}
          results={results}
          onBack={() => { setResume(true); setQuizNonce((n) => n + 1); setPhase('quiz'); }}
          onRetry={() => { setResume(false); setQuizNonce((n) => n + 1); setPhase('quiz'); }}
          onNewGuest={newGuest}
        />
      )}
    </div>
  );
}
