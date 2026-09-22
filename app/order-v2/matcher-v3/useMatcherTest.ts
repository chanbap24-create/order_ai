'use client';

import { useState } from 'react';
import type { V3Result } from '@/app/lib/matcher-v3';

export type CompareRow = {
  line: string;
  v2: { item_no: string | null; item_name: string | null; score: number | null;
    candidates: Array<{ item_no: string; item_name: string; score: number }> } | null;
  v3: V3Result;
  agree: boolean;
};

export type ClientInfo = { code: string; name: string; historyItems: number } | null;

export function useMatcherTest() {
  const [text, setText] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [client, setClient] = useState<ClientInfo>(null);
  const [ranWithCode, setRanWithCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20);
    if (lines.length === 0) { setErr('발주 라인을 입력하세요.'); return; }
    setLoading(true); setErr(''); setRows(null); setClient(null);
    setRanWithCode(!!clientCode.trim());
    try {
      const res = await fetch('/api/order-v2/match-v3', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, client_code: clientCode.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '실행 실패');
      setRows(j.rows);
      setClient(j.client ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '실행 실패');
    } finally {
      setLoading(false);
    }
  };

  return { text, setText, clientCode, setClientCode, rows, client, ranWithCode, loading, err, run };
}
