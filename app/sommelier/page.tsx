'use client';

// 백화점 소믈리에 — 직원이 손님 취향을 문답으로 받아 재고 와인을 추천.
// 세일즈 계정 로그인 필요(직원 휴대폰 사용 전제, 모바일 우선).
import { useEffect, useState } from 'react';
import { LoginCard } from '../sales/page-auth/components/LoginCard';
import { Quiz } from './components/Quiz';
import { ResultCards } from './components/ResultCards';
import type { QuizAnswers } from './lib/quiz';
import type { SommelierResult } from '@/app/lib/sommelierRecommend';

export default function SommelierPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [managerList, setManagerList] = useState<string[]>([]);
  const [results, setResults] = useState<SommelierResult[] | null>(null);
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
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '추천에 실패했습니다');
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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>와인 추천</h1>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            손님 취향을 여쭤보며 선택하면, 재고 중에서 꼭 맞는 와인을 찾아드려요
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--status-danger)', marginBottom: 12 }}>{error}</div>
        )}

        {results === null
          ? <Quiz onSubmit={submit} submitting={submitting} />
          : <ResultCards results={results} onRetry={() => setResults(null)} />}
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
