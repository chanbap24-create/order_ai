'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { loadRecSettings } from '@/app/sales/recommend/recSettings';
import { DEFAULT_REC_COLS } from '@/app/sales/recommend/constants';
import { selectQuoteItems } from '@/app/sales/recommend/allocateByTypeShares';
import type { ScoredItem } from '@/app/sales/recommend/types';

export type BatchTarget = { client_code: string; client_name: string };

/** 추천견적 탭에 저장된 컬럼 설정(없으면 기본값) */
function loadCols(): string[] {
  if (typeof window === 'undefined') return DEFAULT_REC_COLS;
  try {
    const s = localStorage.getItem('recommend_quote_columns');
    if (s) { const v = JSON.parse(s); if (Array.isArray(v) && v.length) return v; }
  } catch { /* ignore */ }
  return DEFAULT_REC_COLS;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 거래처 다중 선택 → 한꺼번에 추천견적 생성.
 * 추천견적 탭 설정(localStorage)을 그대로 재사용한다(설정 중복 없음).
 * 작업 초안은 '<manager>::batch' 스코프로 격리(인벤토리·추천 편집과 무간섭),
 * 엑셀 발행 시 saved_quotes 자동저장은 export 라우트가 스코프를 떼고 실제 manager로 기록.
 * 결과: 1곳=단일 xlsx, 복수=ZIP.
 */
export function useBatchRecommend(manager: string) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string }>({ done: 0, total: 0, name: '' });
  const [message, setMessage] = useState<string | null>(null);

  const run = async (targets: BatchTarget[]) => {
    if (running || targets.length === 0) return;
    setRunning(true);
    setMessage(null);

    const s = loadRecSettings();
    const cols = loadCols();
    const scope = `${manager}::batch`;
    // 대체상품 모드는 기준 상품이 필요해 배치 불가 → 신규제안으로 처리
    const mode = s.mode === 'substitute' ? 'new' : s.mode;

    const files: { name: string; blob: Blob }[] = [];
    const failed: string[] = [];
    const winbackNames: string[] = []; // 윈백가(발주 리듬 끊김 보정)가 적용된 거래처
    setProgress({ done: 0, total: targets.length, name: '' });

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setProgress({ done: i, total: targets.length, name: t.client_name });
      try {
        // 1) 추천 생성 (추천견적 탭 설정 그대로)
        const recRes = await fetch('/api/sales/recommend', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_code: t.client_code,
            price_band: s.priceBand / 100,
            profile_months: s.periodMonths,
            geo_ceiling: s.geoCeiling,
            stock_months: s.stockMonths,
            min_stock: s.minStock,
            score_params: s.scoreParams,
            mode,
            include_nonstandard: s.includeNonStandard,
            discount_apply: s.discountApply,
            discount_scope: s.discountScope,
            grade_step_up: s.gradeStepUp,
            ...(mode === 'discovery' ? {
              discovery_types: s.discoveryTypes,
              discovery_min_price: s.discoveryMinPrice,
              discovery_max_price: s.discoveryMaxPrice,
              discovery_segment: s.discoverySegment,
            } : {}),
          }),
        });
        const recJson = await recRes.json();
        const recs: ScoredItem[] = Array.isArray(recJson?.recommendations) ? recJson.recommendations : [];
        // 단독 추천 탭과 완전 동일한 선정·정렬: 공용 selectQuoteItems(필터→점수순→타입배분→표시정렬).
        const shares: Record<string, number> = recJson?.typeShares || {};
        const items = selectQuoteItems(recs, shares, {
          lockCount: s.lockCount, maxPerType: s.maxPerType, minScore: s.minScore,
        });
        if (items.length === 0) { failed.push(`${t.client_name}(추천없음)`); continue; }
        if (recJson?.client?.winback) winbackNames.push(t.client_name);

        // 2) 보강 적재 (배치 스코프, 기존 비우고 새로)
        const qRes = await fetch('/api/sales/recommend/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items, client_code: t.client_code, client_name: t.client_name,
            manager: scope, clear_existing: true,
          }),
        });
        const qJson = await qRes.json();
        if (qJson?.error) { failed.push(t.client_name); continue; }

        // 3) 엑셀 발행 + saved_quotes 자동저장(실제 manager)
        const params = new URLSearchParams();
        params.set('manager', scope);
        params.set('client_name', t.client_name);
        if (t.client_code) params.set('client_code', t.client_code);
        params.set('company', 'CDV');
        params.set('columns', JSON.stringify(cols));
        const exRes = await fetch(`/api/quote/export?${params.toString()}`);
        if (!exRes.ok) { failed.push(t.client_name); continue; }
        const blob = await exRes.blob();
        files.push({ name: `추천견적_${stamp()}_${safeName(t.client_name)}.xlsx`, blob });
      } catch {
        failed.push(t.client_name);
      }
    }
    setProgress({ done: targets.length, total: targets.length, name: '' });

    // 다운로드: 1곳=단일 xlsx, 복수=ZIP
    if (files.length === 1) {
      download(files[0].blob, files[0].name);
    } else if (files.length > 1) {
      const zip = new JSZip();
      for (const f of files) zip.file(f.name, f.blob);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      download(zipBlob, `추천견적_${stamp()}_${files.length}곳.zip`);
    }

    setRunning(false);
    const wb = winbackNames.length
      ? ` · 윈백가 적용 ${winbackNames.length}곳(${winbackNames.slice(0, 5).join(', ')}${winbackNames.length > 5 ? ' 외' : ''})`
      : '';
    setMessage(
      failed.length
        ? `${files.length}곳 생성 완료 · ${failed.length}곳 건너뜀(${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' 외' : ''})${wb}`
        : `${files.length}곳 추천견적 생성 완료${wb}`,
    );
  };

  return { running, progress, message, run, clearMessage: () => setMessage(null) };
}
