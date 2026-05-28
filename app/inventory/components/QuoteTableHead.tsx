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
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { QuoteColumnConfig } from "../types";
import { qThStyle } from "./sharedStyles";

type Props = {
  visibleQuoteCols: QuoteColumnConfig[];
  onReorderColumns: (
    updater: (prev: QuoteColumnConfig[]) => QuoteColumnConfig[],
  ) => void;
};

/** 견적 테이블 헤더 — 순서 열 + 컬럼 라벨 드래그 (DnD) */
export function QuoteTableHead({ visibleQuoteCols, onReorderColumns }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const colIds = visibleQuoteCols.map((c) => c.key);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = colIds.indexOf(String(active.id));
    const to = colIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorderColumns((prev) => {
      const a = [...prev];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
  }

  return (
    <thead style={{ position: "sticky", top: 0, zIndex: 4 }}>
      <tr style={{ background: "#fafaf8" }}>
        <th
          style={{
            ...qThStyle,
            width: 60,
            position: "sticky",
            left: 0,
            background: "#fafaf8",
            zIndex: 5,
            boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)",
          }}
        >
          순서
        </th>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
            {visibleQuoteCols.map((col) => (
              <SortableColumnHead key={col.key} col={col} />
            ))}
          </SortableContext>
        </DndContext>
        <th style={{ ...qThStyle, width: 36, background: "#fafaf8" }}></th>
      </tr>
    </thead>
  );
}

function SortableColumnHead({ col }: { col: QuoteColumnConfig }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.key });
  const style: React.CSSProperties = {
    ...qThStyle,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "#fff8e1" : "#fafaf8",
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    textAlign:
      col.type === "currency" || col.type === "computed" ? "right" : "center",
  };
  return (
    <th ref={setNodeRef} style={style} {...attributes} {...listeners} title="드래그하여 컬럼 순서 변경">
      {col.label}
    </th>
  );
}
