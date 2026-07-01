'use client';

import { useState } from 'react';
import type { TastingWineRow } from '../types';
import type { PipelineProgress } from '../hooks/useNewWinePipeline';

type Props = {
  wines: TastingWineRow[];
  running: boolean;
  progress: PipelineProgress;
  result: string | null;
  onRun: (rows: TastingWineRow[]) => void;
  onClose: () => void;
};

/** 신규 와인 감지 팝업 — 체크 후 'AI 리서치 → PPTX/PDF 발행 → 인덱스' 일괄 실행. */
export function NewWinePopup({ wines, running, progress, result, onRun, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(wines.map((w) => w.item_code)));
  const allChecked = wines.length > 0 && wines.every((w) => checked.has(w.item_code));

  const toggle = (code: string) =>
    setChecked((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const toggleAll = () =>
    setChecked(() => (allChecked ? new Set() : new Set(wines.map((w) => w.item_code))));

  const selected = wines.filter((w) => checked.has(w.item_code));

  return (
    <div onClick={running ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: 'min(560px, 92vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🍷</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>신규 와인 {wines.length}종 감지</span>
          {!running && (
            <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
          )}
        </div>

        <div style={{ padding: '8px 20px', fontSize: 13, color: '#555' }}>
          체크한 와인을 <b>AI 리서치 → PPTX·PDF 발행 → 인덱스</b>까지 한 번에 처리합니다.
        </div>

        <div style={{ padding: '4px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={running} />
            전체 선택 ({selected.length}/{wines.length})
          </label>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 20px', flex: 1 }}>
          {wines.map((w) => (
            <label key={w.item_code}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: 13, cursor: 'pointer', opacity: w.item_name_en?.trim() ? 1 : 0.55 }}>
              <input type="checkbox" checked={checked.has(w.item_code)} onChange={() => toggle(w.item_code)} disabled={running} />
              <span style={{ fontWeight: 600 }}>{w.item_name_kr || w.item_code}</span>
              <span style={{ color: '#999', marginLeft: 'auto', fontSize: 11 }}>{w.item_code}</span>
              {!w.item_name_en?.trim() && <span style={{ color: '#dc2626', fontSize: 11 }}>영문명 없음</span>}
            </label>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee' }}>
          {running ? (
            <div style={{ fontSize: 13, color: '#333' }}>
              ⏳ {progress.phase} {progress.total > 0 ? `${progress.current}/${progress.total}` : ''} {progress.name ? `· ${progress.name}` : ''}
            </div>
          ) : result ? (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{result}</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer' }}>나중에</button>
              <button onClick={() => onRun(selected)} disabled={selected.length === 0}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: selected.length ? 'linear-gradient(135deg,#5a1515,#8B2252)' : '#ccc', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selected.length ? 'pointer' : 'default' }}>
                {selected.length}종 일괄 생성·발행
              </button>
            </div>
          )}
          {result && !running && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer' }}>닫기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
