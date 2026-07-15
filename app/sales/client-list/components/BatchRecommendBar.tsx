'use client';

import { useState } from 'react';
import { loadRecSettings } from '@/app/sales/recommend/recSettings';
import { QuoteColumnsMenu } from '@/app/sales/recommend/components/QuoteColumnsMenu';

type StepUpMode = boolean | 'auto';

type Props = {
  count: number;
  running: boolean;
  progress: { done: number; total: number; name: string };
  message: string | null;
  onRun: (opts: { gradeStepUp: StepUpMode }) => void;
  onClear: () => void;
  // 견적서 컬럼(계정별 저장, useQuoteCols) — 생성 전 이 바에서 바로 조정
  quoteCols: string[];
  onToggleCol: (key: string) => void;
  onReorderCols?: (next: string[]) => void;
  colsScope?: string; // '그룹명' — 그룹별 컬럼 편집 중임을 표기(없으면 계정 기본)
  onResetCols: () => void;
};

const STEP_UP_OPTS: Array<{ v: StepUpMode; t: string }> = [
  { v: false, t: '끄기' },
  { v: 'auto', t: '자동(하위만)' },
  { v: true, t: '전체' },
];

/** 거래처 다중 선택 → 추천견적 일괄 생성 액션 바. 1곳=단일 xlsx, 복수=ZIP.
 *  하위거래처 보정(할인 단계업)은 다운로드 전에 여기서 선택(추천견적 탭 설정이 초기값):
 *  자동=매출등급 미달 거래처만 1단계업 · 전체=선택 거래처 전부 1단계업. */
export function BatchRecommendBar({
  count, running, progress, message, onRun, onClear, quoteCols, onToggleCol, onReorderCols, onResetCols, colsScope,
}: Props) {
  const [stepUp, setStepUp] = useState<StepUpMode>(() => loadRecSettings().gradeStepUp);
  const [showCols, setShowCols] = useState(false);
  const idle = count === 0 && !running && !message;
  if (idle) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      background: '#fff', border: '1px solid var(--action-muted)', borderRadius: 12,
      padding: '10px 14px',
    }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        {running ? (
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            추천견적 생성 중… {progress.done}/{progress.total}
            {progress.name ? ` · ${progress.name}` : ''}
          </span>
        ) : message ? (
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{message}</span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {count}곳 선택됨
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              추천견적 탭 설정 그대로 적용 · 1곳=엑셀, 여러 곳=ZIP
            </span>
          </span>
        )}
      </div>

      {count > 0 && !running && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          title="매출등급을 한 단계 위 티어로 계산(업소·샵) — 자동=등급 미달 거래처만, 전체=선택 전부">
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>하위거래처 보정</span>
          {STEP_UP_OPTS.map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setStepUp(o.v)}
              style={{
                padding: '6px 10px', borderRadius: 8,
                border: `1px solid ${stepUp === o.v ? 'var(--action)' : 'var(--gray-300)'}`,
                background: stepUp === o.v ? 'var(--action)' : '#fff',
                color: stepUp === o.v ? '#fff' : 'var(--text-tertiary)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {o.t}
            </button>
          ))}
        </span>
      )}
      {!running && (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            onClick={() => setShowCols((v) => !v)}
            title={colsScope ? `'${colsScope}' 그룹 전용 컬럼 — 이 그룹으로 생성할 때만 적용` : '엑셀 견적서 컬럼 — 계정 기본(그룹 미선택 시) 저장'}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${showCols ? 'var(--action)' : 'var(--gray-300)'}`,
              background: '#fff', color: showCols ? 'var(--action)' : 'var(--text-tertiary)',
              fontSize: 13, cursor: 'pointer',
            }}
          >⚙ 컬럼 {quoteCols.length}{colsScope ? ` · ${colsScope}` : ''}</button>
          {showCols && (
            <QuoteColumnsMenu
              quoteCols={quoteCols}
              toggle={onToggleCol}
              reorder={onReorderCols}
              reset={onResetCols}
              onClose={() => setShowCols(false)}
            />
          )}
        </span>
      )}
      {count > 0 && !running && (
        <button onClick={onClear} style={{
          padding: '7px 12px', borderRadius: 8, border: '1px solid var(--gray-300)',
          background: '#fff', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer',
        }}>선택 해제</button>
      )}
      <button
        onClick={() => onRun({ gradeStepUp: stepUp })}
        disabled={running || count === 0}
        style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: running || count === 0 ? 'var(--gray-300)' : 'var(--action)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: running || count === 0 ? 'default' : 'pointer',
        }}
      >
        {running ? '생성 중…' : `추천견적 한꺼번에 받기${count > 0 ? ` (${count}곳)` : ''}`}
      </button>
    </div>
  );
}
