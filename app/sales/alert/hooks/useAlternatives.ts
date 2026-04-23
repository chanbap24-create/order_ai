'use client';

import { useState } from 'react';
import type { Alternative } from '../types';

export function useAlternatives() {
  const [altItemNo, setAltItemNo] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [altSelected, setAltSelected] = useState<Set<string>>(new Set());
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null);

  const openAlternatives = async (itemNo: string) => {
    if (altItemNo === itemNo) {
      setAltItemNo(null);
      return;
    }
    setAltItemNo(itemNo);
    setAlternatives([]);
    setAltSelected(new Set());
    setQuoteMsg(null);
    setAltLoading(true);

    try {
      const res = await fetch(`/api/sales/alerts/alternatives?item_no=${encodeURIComponent(itemNo)}`);
      const data = await res.json();
      setAlternatives(data.alternatives || []);
    } catch { /* ignore */ }
    finally { setAltLoading(false); }
  };

  const toggleAlt = (itemNo: string) => {
    setAltSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo); else next.add(itemNo);
      return next;
    });
  };

  const addToQuote = async () => {
    if (altSelected.size === 0) return;
    setQuoteLoading(true);
    setQuoteMsg(null);

    const items = alternatives
      .filter(a => altSelected.has(a.item_no))
      .map(a => ({ item_no: a.item_no, item_name: a.item_name, price: a.price, country: a.country }));

    try {
      const res = await fetch('/api/sales/recommend/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setQuoteMsg(`${data.added_count}개 와인이 견적서에 추가되었습니다.`);
        setAltSelected(new Set());
      } else {
        setQuoteMsg('견적서 추가 중 오류가 발생했습니다.');
      }
    } catch {
      setQuoteMsg('견적서 추가 중 오류가 발생했습니다.');
    } finally {
      setQuoteLoading(false);
    }
  };

  return {
    altItemNo, setAltItemNo,
    alternatives, altLoading, altSelected,
    quoteLoading, quoteMsg,
    openAlternatives, toggleAlt, addToQuote,
  };
}
