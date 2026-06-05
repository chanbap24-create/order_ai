"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { QUOTE_COLUMNS } from "../constants/columns";
import type { QuoteColumnKey } from "../types";

type Props = {
  visibleColumns: QuoteColumnKey[];
  setVisibleColumns: (updater: (prev: QuoteColumnKey[]) => QuoteColumnKey[]) => void;
};

/** 견적 컬럼 표시/순서 설정 (드래그&드롭 + 체크박스 목록) */
export function QuoteColumnSettings({ visibleColumns, setVisibleColumns }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setVisibleColumns((prev) => {
      const from = prev.indexOf(active.id as QuoteColumnKey);
      const to = prev.indexOf(over.id as QuoteColumnKey);
      if (from < 0 || to < 0) return prev;
      const a = [...prev];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
  }

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 14,
        background: "var(--gray-50)",
        borderRadius: 8,
        border: "1px solid var(--gray-100)",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, color: "var(--neutral-700)" }}>
        견적 컬럼 (체크 + 드래그로 순서 변경)
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", color: "var(--neutral-100)", marginBottom: 4 }}>
          표시 순서 (드래그하여 이동)
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleColumns} strategy={rectSortingStrategy}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {visibleColumns.map((key) => {
                const col = QUOTE_COLUMNS.find((c) => c.key === key);
                if (!col) return null;
                return <SortableChip key={key} id={key} label={col.label} />;
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {QUOTE_COLUMNS.map((col) => {
          const active = visibleColumns.includes(col.key);
          return (
            <label
              key={col.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                background: active ? "var(--action-muted)" : "#fff",
                border: `1px solid ${active ? "rgba(90,21,21,0.2)" : "var(--gray-200)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() =>
                  setVisibleColumns((prev) =>
                    prev.includes(col.key)
                      ? prev.filter((k) => k !== col.key)
                      : [...prev, col.key],
                  )
                }
                style={{ width: 14, height: 14 }}
              />
              {col.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SortableChip({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    padding: "4px 10px",
    borderRadius: 6,
    background: isDragging ? "#fff8e1" : "#fff",
    border: "1px solid rgba(90,21,21,0.2)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--neutral-700)",
  };
  return (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {label}
    </span>
  );
}
