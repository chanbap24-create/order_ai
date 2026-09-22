'use client';

// 발주 v3 오케스트레이터 — 거래처/입력/파싱/편집/메시지. 와인(CDV) 전용.
// 검색·이력·배송일·메시지·학습은 v2 모듈 재사용 (복제 금지 원칙).
import { useMemo, useRef, useState } from 'react';
import type { OrderLine } from '@/app/order-v2/types';
import { useClientSearch } from '@/app/order-v2/hooks/useClientSearch';
import { useClientHistory } from '@/app/order-v2/hooks/useClientHistory';
import { useDeliveryDate } from '@/app/order-v2/hooks/useDeliveryDate';
import { useWineSearch } from '@/app/order-v2/hooks/useWineSearch';
import { useImageIntake } from '@/app/order-v2/hooks/useImageIntake';
import type { IntakeResult } from '@/app/order-v2/lib/api';
import { buildStaffMessage, buildClientMessage } from '@/app/order-v2/lib/staffMessage';
import { learnOrderCorrections } from '@/app/order-v2/lib/api';
import { calcTotalAmount } from '@/app/order-v2/lib/priceCalc';
import type { SearchResult } from '@/app/order-v2/types';

export type V3Meta = { decidedBy: string; confidence: number; reason?: string; picked_in_history: boolean; picked_stock: number };
export type V3Line = OrderLine & { v3?: V3Meta };

export function useOrderV3Page() {
  const tab = 'CDV' as const; // v3 매처는 와인 전용 — 글라스(DL)는 v2 사용
  const client = useClientSearch(tab);
  const history = useClientHistory(client.selected?.client_code, tab);
  const delivery = useDeliveryDate(tab);
  const wineSearch = useWineSearch(tab);

  const [orderText, setOrderText] = useState('');
  const orderTextRef = useRef<HTMLTextAreaElement>(null);
  const [lines, setLines] = useState<V3Line[]>([]);
  const [historySet, setHistorySet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discountRates, setDiscountRates] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<'' | 'staff' | 'client'>('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // textOverride/clientCodeOverride: 스샷 추출 직후 자동 분석 — setState 직후엔 클로저가 옛 값을 봐서 인자로 직접 전달
  const parse = async (textOverride?: string, clientCodeOverride?: string | null, fromImage = false) => {
    const text = textOverride ?? orderText;
    const clientCode = clientCodeOverride !== undefined ? clientCodeOverride : (client.selected?.client_code || null);
    if (!text.trim()) return;
    setLoading(true); setError(''); setLines([]);
    setDiscountRates({}); setExpanded(new Set());
    try {
      const res = await fetch('/api/order-v3/parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_text: text, client_code: clientCode, from_image: fromImage }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '분석 실패');
      // v2 OrderLine 규약: selectedIdx=0(후보 있으면), llm_top_item_no=파싱 1순위(학습 기준)
      const mapped: V3Line[] = (j.orderLines || []).map((ol: V3Line) => ({
        ...ol,
        selectedIdx: ol.candidates.length > 0 ? 0 : -1,
        llm_top_item_no: ol.candidates[0]?.item_no,
      }));
      setLines(mapped);
      setHistorySet(new Set((j.historyItemNos || []).map((n: string) => n.trim().toUpperCase())));
      if (mapped.length === 0) setError('와인 주문 라인을 찾지 못했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOrderText(''); setLines([]); setError(''); setDiscountRates({});
    setExpanded(new Set()); setDeliveryNotes(''); client.setSelected(null); client.setQuery('');
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setOrderText(t);
    } catch { orderTextRef.current?.focus(); }
  };

  // ── 카톡 스크린샷 인테이크 — v2 extract 재사용. 추출 성공 시 거래처+발주문 채움 ──
  const applyExtraction = (r: IntakeResult) => {
    setOrderText(r.order_text || '');
    let code: string | null = null;
    if (r.client_code && r.client_name && (r.client_confidence ?? 0) >= 0.75) {
      client.pick({ client_code: r.client_code, client_name: r.client_name });
      code = r.client_code;
    } else if (r.client_hint) {
      client.setQuery(r.client_hint);
      client.setShowDropdown(true);
    }
    // 스샷 추출 성공 → 분석 버튼 없이 바로 실행
    if (r.order_text?.trim()) void parse(r.order_text, code, true); // 비전 추출 정형 텍스트 → 빠른 파서
  };
  const imageIntake = useImageIntake(applyExtraction, tab);
  const handleFiles = (files: File[]) => {
    // v3는 단건 처리 — 여러 장이면 첫 장만 (배치는 v2 사용 안내)
    if (files.length > 1) imageIntake.processFile(files[0]);
    else if (files[0]) imageIntake.processFile(files[0]);
  };

  // ── 라인 편집 ──
  const updateLine = (idx: number, patch: Partial<V3Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const setQty = (idx: number, qty: number) => { if (qty >= 1) updateLine(idx, { quantity: qty }); };
  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setDiscountRates((prev) => {
      const next: Record<number, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        const n = Number(k);
        if (n < idx) next[n] = v; else if (n > idx) next[n - 1] = v;
      }
      return next;
    });
  };
  const selectCandidate = (idx: number, cIdx: number) => updateLine(idx, { selectedIdx: cIdx });
  const replaceWithSearch = (idx: number, wine: SearchResult) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const cand = {
        item_no: wine.item_no, item_name: wine.item_name, confidence: 1,
        supply_price: wine.supply_price || 0, available_stock: wine.available_stock || 0,
        reasoning: '직접 선택',
      };
      return { ...l, candidates: [cand, ...l.candidates.filter((c) => c.item_no !== wine.item_no)], selectedIdx: 0 };
    }));
    wineSearch.setIdx(null);
  };
  const addLineFromHistory = (item: { item_no: string; item_name: string; supply_price: number }) => {
    setLines((prev) => [...prev, {
      query: item.item_name, quantity: 1, selectedIdx: 0, llm_top_item_no: item.item_no,
      candidates: [{
        item_no: item.item_no, item_name: item.item_name, confidence: 1,
        supply_price: item.supply_price || 0, available_stock: 0, reasoning: '입고내역에서 추가',
      }],
    }]);
  };
  const toggleExpand = (idx: number) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  const setDiscount = (idx: number, rate: number) => setDiscountRates((p) => ({ ...p, [idx]: rate }));

  // ── 메시지 ──
  const msgParams = {
    orderLines: lines, tab, selectedClient: client.selected, clientQuery: client.query,
    discountRates, historySet, finalDeliveryLabel: delivery.finalLabel, deliveryNotes,
  };
  const staffMessage = useMemo(() => buildStaffMessage(msgParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, discountRates, historySet, delivery.finalLabel, deliveryNotes, client.selected, client.query]);
  const clientMessage = useMemo(() => buildClientMessage(msgParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, discountRates, historySet, delivery.finalLabel, deliveryNotes, client.selected, client.query]);

  const copy = async (which: 'staff' | 'client') => {
    const text = which === 'staff' ? staffMessage : clientMessage;
    try {
      await navigator.clipboard.writeText(text);
      // 성공했을 때만 '복사됨' 표시 + 학습 — 자동 복사(제스처 없음)는 iOS가 막을 수 있고,
      // 그 경우 버튼이 '복사' 대기 상태로 남아 사용자가 한 번 탭하면 된다.
      setCopied(which);
      setTimeout(() => setCopied(''), 1600);
      if (which === 'staff') learnOrderCorrections(lines); // 확정 시점 정정 학습 (v2와 동일)
    } catch { /* 클립보드 차단 — 버튼 수동 탭 폴백 */ }
  };

  const totalAmount = calcTotalAmount(lines, discountRates);

  return {
    tab, client, history, delivery, wineSearch,
    orderText, setOrderText, orderTextRef, pasteFromClipboard,
    lines, historySet, loading, error, parse, reset,
    setQty, removeLine, selectCandidate, replaceWithSearch, addLineFromHistory,
    expanded, toggleExpand, discountRates, setDiscount,
    deliveryNotes, setDeliveryNotes,
    staffMessage, clientMessage, copied, copy, totalAmount,
    imageIntake, handleFiles,
  };
}
