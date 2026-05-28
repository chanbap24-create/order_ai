"use client";

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
};

/** 견적 테이블 헤더 — 순서 열 + 컬럼 라벨 드래그 (SortableContext only — DndContext 는 부모에 있음) */
export function QuoteTableHead({ visibleQuoteCols }: Props) {
  const colIds = visibleQuoteCols.map((c) => c.key);

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
        <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
          {visibleQuoteCols.map((col) => (
            <SortableColumnHead key={col.key} col={col} />
          ))}
        </SortableContext>
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
