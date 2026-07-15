'use client';

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QUOTE_COL_OPTIONS } from '../constants';

type Props = {
  quoteCols: string[];
  toggle: (key: string) => void;
  /** 체크된 컬럼의 새 순서 반영(배열 순서 = 엑셀 열 순서) */
  reorder?: (next: string[]) => void;
  reset: () => void;
  onClose: () => void;
};

const LABEL: Record<string, string> = Object.fromEntries(QUOTE_COL_OPTIONS.map((c) => [c.key, c.label]));

/** 체크된 컬럼 한 줄 — 드래그 핸들(⠿) + 체크 해제 */
function SortableRow({ colKey, toggle }: { colKey: string; toggle: (k: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
        fontSize: 13, color: 'var(--neutral-700)',
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1, background: isDragging ? 'var(--surface-hover)' : 'transparent',
        borderRadius: 6,
      }}
    >
      <span
        {...attributes}
        {...listeners}
        title="드래그해서 순서 변경"
        style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px', touchAction: 'none' }}
      >⠿</span>
      <input type="checkbox" checked onChange={() => toggle(colKey)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
      <span style={{ flex: 1 }}>{LABEL[colKey]}</span>
    </div>
  );
}

export function QuoteColumnsMenu({ quoteCols, toggle, reorder, reset, onClose }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const checked = quoteCols.filter((k) => LABEL[k]); // 저장된 순서 그대로 (= 엑셀 열 순서)
  const unchecked = QUOTE_COL_OPTIONS.filter((c) => !quoteCols.includes(c.key));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!reorder || !over || active.id === over.id) return;
    const from = checked.indexOf(String(active.id));
    const to = checked.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...checked];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    reorder(next);
  };

  return (
    <div style={{
      position: 'absolute', bottom: 44, right: 0, background: '#fff',
      border: '1px solid var(--border-default)', borderRadius: 12, padding: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
      width: 230, maxHeight: 360, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--action)', marginBottom: 2 }}>견적서 컬럼</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8 }}>
        드래그(⠿)로 순서 변경 · 위→아래 = 엑셀 왼→오른쪽
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={checked} strategy={verticalListSortingStrategy}>
          {checked.map((key) => (
            <SortableRow key={key} colKey={key} toggle={toggle} />
          ))}
        </SortableContext>
      </DndContext>
      {unchecked.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 6, paddingTop: 6 }}>
          {unchecked.map((col) => (
            <label key={col.key} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 3px 21px',
              fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              <input type="checkbox" checked={false} onChange={() => toggle(col.key)} style={{ width: 14, height: 14 }} />
              {col.label}
            </label>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button
          onClick={reset}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--gray-300)',
            background: '#fff', fontSize: 11, cursor: 'pointer', color: 'var(--neutral-400)',
          }}
        >
          초기화
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
            background: 'var(--action)', color: '#fff', fontSize: 11, cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
