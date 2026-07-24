'use client';

// 백화점 소믈리에 — 손님과 함께 보는 취향 문답 추천.
// 흐름: 직원 로그인 → 고객 정보(성함·핸드폰) → 문답 5단계 → 추천 → 구매 기록.
import { useEffect, useState } from 'react';
import { LoginCard } from '../sales/page-auth/components/LoginCard';
import { SommelierStyles } from './components/SommelierStyles';
import { CustomerIntro } from './components/CustomerIntro';
import { Quiz } from './components/Quiz';
import { ResultCards } from './components/ResultCards';
import type { QuizAnswers } from './lib/quiz';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';
import type { SommelierCustomer } from '@/app/lib/sommelierDb';

export default function SommelierPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [managerList, setManagerList] = useState<string[]>([]);

  const [customer, setCustomer] = useState<SommelierCustomer | null>(null);
  const [results, setResults] = useState<SommelierResult[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
      fetch('/api/sales/clients/managers').then((r) => r.json()).catch(() => null),
    ]).then(([me, mgr]) => {
      setAuthed(!!me?.authenticated);
      setManagerList(Array.isArray(mgr?.managers) ? mgr.managers : []);
      setChecking(false);
    });
  }, []);

  const submit = async (answers: QuizAnswers) => {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/sommelier/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, customerId: customer?.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '추천에 실패했습니다');
      setSessionId(j.sessionId || null);
      setResults(j.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return <Center><span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>확인 중...</span></Center>;
  }
  if (!authed) {
    return <LoginCard managerList={managerList} onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: '#fff' }}>
      <SommelierStyles />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 18px 80px' }}>
        {error && (
          <div style={{ fontSize: 13, color: 'var(--status-danger)', marginBottom: 12 }}>{error}</div>
        )}

        {!customer && <CustomerIntro onStart={setCustomer} />}

        {customer && results === null && (
          <Quiz customerName={customer.name} onSubmit={submit} submitting={submitting} />
        )}

        {customer && results !== null && (
          <ResultCards
            customerName={customer.name}
            customerId={customer.id}
            sessionId={sessionId}
            results={results}
            onRetry={() => { setResults(null); setSessionId(null); }}
          />
        )}

        {/* 새 손님 시작 — 결과까지 마친 뒤 초기화 */}
        {customer && results !== null && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button onClick={() => { setCustomer(null); setResults(null); setSessionId(null); }} style={{
              border: 'none', background: 'none', fontSize: 12.5, color: 'var(--text-muted)',
              cursor: 'pointer', textDecoration: 'underline', padding: 6,
            }}>
              새 손님 응대 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)', background: 'var(--surface-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</div>
  );
}
