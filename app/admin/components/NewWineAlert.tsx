'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NewWinePopup } from '../tasting-note/components/NewWinePopup';
import { useLoadGate } from '@/app/components/ui/LoadGate';
import { useNewWinePipeline } from '../tasting-note/hooks/useNewWinePipeline';
import { isActionableNew } from '../tasting-note/constants';
import type { TastingWineRow } from '../tasting-note/types';

const SEEN_KEY = 'tn_new_seen'; // 이미 알린 신규 품번(중복 팝업 방지) — 시음노트 탭과 공유

/**
 * 어드민 전역 신규 와인 감지 팝업.
 * 어느 탭에 있든(재고 업로드 직후 포함) 미확인 신규 와인이 있으면 즉시 팝업으로 알린다.
 * refreshKey 가 바뀌면(업로드 완료 등) 재조회.
 */
export default function NewWineAlert({
  refreshKey,
  onCountChange,
}: {
  refreshKey: number;
  onCountChange?: (n: number) => void;
}) {
  const [wines, setWines] = useState<TastingWineRow[]>([]);
  const [open, setOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);
  // 부팅 커튼 등록 — 신규 배지·팝업이 나중에 튀지 않고 첫 공개에 포함되게
  const [initialLoading, setInitialLoading] = useState(true);
  useLoadGate('new-wine-alert', initialLoading);

  useEffect(() => {
    try { seenRef.current = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { /* ignore */ }
    setSeenLoaded(true);
  }, []);

  // forceOpen=true(업로드 직후): seen 무관하게 신규가 있으면 무조건 팝업.
  // forceOpen=false(페이지 진입): 미확인(seen 아님)만 팝업.
  const fetchNew = useCallback(async (forceOpen: boolean) => {
    try {
      const [wRes, iRes] = await Promise.all([
        fetch('/api/admin/tasting-notes'),
        fetch('/api/tasting-notes', { cache: 'no-store' }),
      ]);
      const wData = await wRes.json();
      const iData = await iRes.json().catch(() => ({}));
      if (!wData.success) return;
      const gh: Record<string, boolean> = {};
      if (iData?.notes) {
        for (const [code, info] of Object.entries(iData.notes as Record<string, { exists?: boolean }>)) {
          if (info?.exists) gh[code] = true;
        }
      }
      const news = (wData.data as TastingWineRow[]).filter((w) =>
        isActionableNew(w, !!(w.tasting_note_id || gh[w.item_code]), { requireWineCategory: true }),
      );
      setWines(news);
      onCountChange?.(news.length);
      if (news.length > 0 && (forceOpen || news.some((w) => !seenRef.current.has(w.item_code)))) {
        setOpen(true);
      }
    } catch { /* ignore */ }
  }, [onCountChange]);

  // 진입(마운트): 미확인 신규만 팝업
  useEffect(() => {
    if (!seenLoaded) return;
    fetchNew(false).finally(() => setInitialLoading(false));
  }, [seenLoaded, fetchNew]);

  // 업로드 완료(refreshKey 증가): seen 무관하게 무조건 팝업. 최초 값(마운트)은 변화로 보지 않음.
  const lastRefreshRef = useRef(refreshKey);
  useEffect(() => {
    if (!seenLoaded) return;
    if (lastRefreshRef.current === refreshKey) return;
    lastRefreshRef.current = refreshKey;
    fetchNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, seenLoaded]);

  const pipeline = useNewWinePipeline({ onDone: () => fetchNew() });

  const close = () => {
    for (const w of wines) seenRef.current.add(w.item_code);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current])); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open || wines.length === 0) return null;
  return (
    <NewWinePopup
      wines={wines}
      running={pipeline.running}
      progress={pipeline.progress}
      result={pipeline.result}
      onRun={pipeline.run}
      onClose={close}
    />
  );
}
