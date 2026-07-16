'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { loadRecSettings } from '@/app/sales/recommend/recSettings';
import { DEFAULT_REC_COLS } from '@/app/sales/recommend/constants';
import { selectQuoteItems } from '@/app/sales/recommend/allocateByTypeShares';
import { renderQuoteImage, vintageFromCode } from '@/app/sales/recommend/lib/quoteImage';
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

  const run = async (targets: BatchTarget[], opts?: { gradeStepUp?: boolean | 'auto'; cols?: string[]; tnote?: boolean; png?: boolean }) => {
    if (running || targets.length === 0) return;
    setRunning(true);
    setMessage(null);

    // 액션 바에서 하위거래처 보정(할인 단계업)을 배치 한정으로 켜고 끌 수 있게 오버라이드
    const s = { ...loadRecSettings(), ...(opts?.gradeStepUp != null ? { gradeStepUp: opts.gradeStepUp } : {}) };
    // 컬럼: 액션 바(계정별 useQuoteCols)에서 전달되면 우선, 없으면 localStorage 캐시
    const cols = opts?.cols && opts.cols.length ? opts.cols : loadCols();
    const scope = `${manager}::batch`;
    // 대체상품 모드는 기준 상품이 필요해 배치 불가 → 신규제안으로 처리
    const mode = s.mode === 'substitute' ? 'new' : s.mode;

    const files: { name: string; blob: Blob }[] = [];
    const failed: string[] = [];
    const winbackNames: string[] = []; // 윈백가(발주 리듬 끊김 보정)가 적용된 거래처
    const stepUpLockedNames: string[] = []; // 보정 잠김(이번 분기 이미 사용) 거래처
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
        if (recJson?.client?.step_up_locked) stepUpLockedNames.push(t.client_name);

        // 2) 보강 적재 (배치 스코프, 기존 비우고 새로)
        //    step_up_used: 보정이 실제 적용된 견적이면 서버가 분기 1회 사용을 기록(락)
        const qRes = await fetch('/api/sales/recommend/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items, client_code: t.client_code, client_name: t.client_name,
            manager: scope, clear_existing: true,
            ...(recJson?.client?.step_up_applied ? { step_up_used: true } : {}),
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

        // 3.5) 카톡 전송용 PNG 견적서 — 채팅방에서 바로 보이는 이미지(엑셀 안 열어도 됨)
        if (opts?.png) {
          try {
            const pngBlob = await renderQuoteImage({
              clientName: t.client_name,
              date: new Date().toISOString().slice(0, 10),
              cols, // 엑셀과 동일한 컬럼 구성·순서
              items: items.map((it) => ({
                name: it.item_name,
                country: it.country || '',
                brand: it.brand || '',
                region: it.region || '',
                grape: it.grape || '',
                vintage: vintageFromCode(it.item_no),
                supply: it.price || 0,
                rate: it.rec_discount || 0,
                qty: it.rec_quantity || 1,
                note: it.rec_note || '',
              })),
            });
            files.push({ name: `견적서_${stamp()}_${safeName(t.client_name)}.png`, blob: pngBlob });
          } catch { /* PNG 실패는 비치명적 */ }
        }

        // 4) 테이스팅노트 PDF — 견적 품목의 노트를 한 파일로 병합(거래처당 1개).
        //    노트 있는 품목이 없으면(404) 조용히 건너뜀 — 견적서는 이미 생성됨.
        if (opts?.tnote !== false) {
          try {
            const pdfRes = await fetch(
              `/api/quote/tasting-notes-pdf?manager=${encodeURIComponent(scope)}&client_name=${encodeURIComponent(t.client_name)}`,
            );
            if (pdfRes.ok) {
              const pdfBlob = await pdfRes.blob();
              files.push({ name: `테이스팅노트_${stamp()}_${safeName(t.client_name)}.pdf`, blob: pdfBlob });
            }
          } catch { /* PDF 실패는 비치명적 */ }
        }
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
    const su = stepUpLockedNames.length
      ? ` · 보정 잠김 ${stepUpLockedNames.length}곳(이번 분기 이미 사용: ${stepUpLockedNames.slice(0, 3).join(', ')}${stepUpLockedNames.length > 3 ? ' 외' : ''})`
      : '';
    setMessage(
      failed.length
        ? `${files.length}곳 생성 완료 · ${failed.length}곳 건너뜀(${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' 외' : ''})${wb}${su}`
        : `${files.length}곳 추천견적 생성 완료${wb}${su}`,
    );
  };

  return { running, progress, message, run, clearMessage: () => setMessage(null) };
}
