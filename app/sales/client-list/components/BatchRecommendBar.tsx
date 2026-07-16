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
  onRun: (opts: { gradeStepUp: StepUpMode; tnote: boolean; png: boolean }) => void;
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
  const [tnote, setTnote] = useState(true); // 거래처당 테이스팅노트 병합 PDF 1개 동봉
  const [png, setPng] = useState(true);     // 카톡 전송용 PNG 견적서 동봉
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
        <button
          onClick={() => setPng((v) => !v)}
          title="켜면 거래처마다 카톡으로 바로 보낼 수 있는 PNG 견적서 이미지를 함께 받습니다"
          style={{
            padding: '7px 12px', borderRadius: 8,
            border: `1px solid ${png ? 'var(--action)' : 'var(--gray-300)'}`,
            background: png ? 'var(--action)' : '#fff',
            color: png ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13, cursor: 'pointer',
          }}
        >PNG 견적{png ? ' ✓' : ''}</button>
      )}
      {!running && (
        <button
          onClick={() => setTnote((v) => !v)}
          title="켜면 거래처마다 견적 품목의 테이스팅노트를 한 PDF로 병합해 함께 받습니다"
          style={{
            padding: '7px 12px', borderRadius: 8,
            border: `1px solid ${tnote ? 'var(--action)' : 'var(--gray-300)'}`,
            background: tnote ? 'var(--action)' : '#fff',
            color: tnote ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13, cursor: 'pointer',
          }}
        >T-Note PDF{tnote ? ' ✓' : ''}</button>
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
        onClick={() => onRun({ gradeStepUp: stepUp, tnote, png })}
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
