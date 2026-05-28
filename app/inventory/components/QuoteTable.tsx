"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TASTING_NOTE_BASE_URL } from "../constants/docDefaults";
import type { QuoteColumnConfig, QuoteItem } from "../types";
import { qTdStyle } from "./sharedStyles";
import { QuoteTableFoot } from "./QuoteTableFoot";
import { QuoteTableHead } from "./QuoteTableHead";

export type EditCell = { id: number; key: string } | null;

type Props = {
  visibleQuoteCols: QuoteColumnConfig[];
  quoteItems: QuoteItem[];
  totalQty: number;
  totalNormal: number;
  totalDiscount: number;
  totalRetailNormal: number;
  totalRetailDiscount: number;
  editCell: EditCell;
  editValue: string;
  setEditCell: (c: EditCell) => void;
  setEditValue: (v: string) => void;
  startEdit: (id: number, key: string, val: any) => void;
  commitEdit: () => void;
  getQuoteCellValue: (item: QuoteItem, key: string) => any;
  formatQuoteCellValue: (item: QuoteItem, col: QuoteColumnConfig) => string;
  tastingNoteSet: Set<string>;
  /** 드래그&드롭 한 번에 임의 위치 이동 */
  onReorderItemTo?: (fromIdx: number, toIdx: number) => void;
  onDeleteItem: (id: number) => void;
  onReorderColumns: (
    updater: (prev: QuoteColumnConfig[]) => QuoteColumnConfig[],
  ) => void;
};

/** 데스크톱 견적 테이블 — Head/Body/Foot 조립 + 인라인 편집 + DnD
 *  X+Y 동시 스크롤 컨테이너. thead sticky top + 첫 컬럼 sticky left.
 *  행: ≡ 핸들 드래그 / 컬럼: 헤더 라벨 드래그.
 */
export function QuoteTable(p: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = p.quoteItems.map((it) => it.id);

  function handleRowDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = itemIds.indexOf(Number(active.id));
    const to = itemIds.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    if (p.onReorderItemTo) p.onReorderItemTo(from, to);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", marginTop: 12 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <QuoteTableHead
            visibleQuoteCols={p.visibleQuoteCols}
            onReorderColumns={p.onReorderColumns}
          />
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {p.quoteItems.map((item, idx) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  idx={idx}
                  visibleQuoteCols={p.visibleQuoteCols}
                  editCell={p.editCell}
                  editValue={p.editValue}
                  setEditCell={p.setEditCell}
                  setEditValue={p.setEditValue}
                  startEdit={p.startEdit}
                  commitEdit={p.commitEdit}
                  getQuoteCellValue={p.getQuoteCellValue}
                  formatQuoteCellValue={p.formatQuoteCellValue}
                  tastingNoteSet={p.tastingNoteSet}
                  onDeleteItem={p.onDeleteItem}
                />
              ))}
            </tbody>
          </SortableContext>
          <QuoteTableFoot
            visibleQuoteCols={p.visibleQuoteCols}
            totalQty={p.totalQty}
            totalNormal={p.totalNormal}
            totalDiscount={p.totalDiscount}
            totalRetailNormal={p.totalRetailNormal}
            totalRetailDiscount={p.totalRetailDiscount}
          />
        </table>
      </DndContext>
    </div>
  );
}

/** 드래그 가능한 행 — useSortable 로 transform + 핸들 */
function SortableRow(props: Parameters<typeof Row>[0]) {
  const sortable = useSortable({ id: props.item.id });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "#fff8e1" : undefined,
  };
  return <Row {...props} dragRef={setNodeRef} dragStyle={style} dragAttributes={attributes} dragListeners={listeners} />;
}

function Row({
  item,
  idx,
  visibleQuoteCols,
  editCell,
  editValue,
  setEditCell,
  setEditValue,
  startEdit,
  commitEdit,
  getQuoteCellValue,
  formatQuoteCellValue,
  tastingNoteSet,
  onDeleteItem,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
}: {
  item: QuoteItem;
  idx: number;
  visibleQuoteCols: QuoteColumnConfig[];
  editCell: EditCell;
  editValue: string;
  setEditCell: (c: EditCell) => void;
  setEditValue: (v: string) => void;
  startEdit: (id: number, key: string, val: any) => void;
  commitEdit: () => void;
  getQuoteCellValue: (item: QuoteItem, key: string) => any;
  formatQuoteCellValue: (item: QuoteItem, col: QuoteColumnConfig) => string;
  tastingNoteSet: Set<string>;
  onDeleteItem: (id: number) => void;
  dragRef?: (el: HTMLElement | null) => void;
  dragStyle?: React.CSSProperties;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
}) {
  return (
    <tr ref={dragRef as React.Ref<HTMLTableRowElement>} style={{ borderBottom: "1px solid #eee", ...dragStyle }} {...dragAttributes}>
      <td
        style={{
          ...qTdStyle,
          textAlign: "center",
          color: "#888",
          whiteSpace: "nowrap",
          position: "sticky",
          left: 0,
          background: dragStyle?.background as string || "white",
          zIndex: 2,
          boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)",
        }}
      >
        <span
          {...dragListeners}
          style={{
            display: "inline-block",
            cursor: "grab",
            userSelect: "none",
            touchAction: "none",
            padding: "2px 10px",
            fontSize: 13,
            fontWeight: 600,
            color: "#666",
          }}
          title="드래그하여 순서 변경"
        >
          {idx + 1}
        </span>
      </td>
      {visibleQuoteCols.map((col) => (
        <Cell
          key={col.key}
          item={item}
          col={col}
          isEditing={editCell?.id === item.id && editCell?.key === col.key}
          editValue={editValue}
          setEditCell={setEditCell}
          setEditValue={setEditValue}
          startEdit={startEdit}
          commitEdit={commitEdit}
          getQuoteCellValue={getQuoteCellValue}
          formatQuoteCellValue={formatQuoteCellValue}
          tastingNoteSet={tastingNoteSet}
        />
      ))}
      <td style={qTdStyle}>
        <button
          onClick={() => onDeleteItem(item.id)}
          style={{
            background: "none",
            border: "none",
            color: "#e74c3c",
            cursor: "pointer",
            fontSize: 16,
            padding: 2,
            lineHeight: 1,
          }}
          title="삭제"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function Cell({
  item,
  col,
  isEditing,
  editValue,
  setEditCell,
  setEditValue,
  startEdit,
  commitEdit,
  getQuoteCellValue,
  formatQuoteCellValue,
  tastingNoteSet,
}: {
  item: QuoteItem;
  col: QuoteColumnConfig;
  isEditing: boolean;
  editValue: string;
  setEditCell: (c: EditCell) => void;
  setEditValue: (v: string) => void;
  startEdit: (id: number, key: string, val: any) => void;
  commitEdit: () => void;
  getQuoteCellValue: (item: QuoteItem, key: string) => any;
  formatQuoteCellValue: (item: QuoteItem, col: QuoteColumnConfig) => string;
  tastingNoteSet: Set<string>;
}) {
  const val = getQuoteCellValue(item, col.key);
  const formatted = formatQuoteCellValue(item, col);
  const align: "left" | "right" | "center" =
    col.type === "currency" || col.type === "computed"
      ? "right"
      : col.type === "number" || col.type === "percent"
        ? "center"
        : "left";

  return (
    <td
      style={{
        ...qTdStyle,
        textAlign: align,
        cursor: col.editable ? "pointer" : "default",
        background: isEditing ? "#FFF9C4" : "transparent",
        fontWeight: col.key === "product_name" ? 600 : 400,
        color: col.key === "discount_total" ? "var(--action)" : "#333",
      }}
      onClick={() => {
        if (col.editable && !isEditing) startEdit(item.id, col.key, val);
      }}
    >
      {isEditing ? (
        <input
          type={col.type === "number" || col.type === "percent" ? "number" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditCell(null);
          }}
          autoFocus
          style={{
            width: "100%",
            fontSize: 13,
            padding: "4px 6px",
            border: "1px solid #85C1E9",
            borderRadius: 4,
            textAlign: align,
            boxSizing: "border-box",
          }}
        />
      ) : col.key === "tasting_note" && item.item_code ? (
        <a
          href={`${TASTING_NOTE_BASE_URL}/${item.item_code}.pdf?v=${Date.now()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: tastingNoteSet.has(item.item_code) ? "#27ae60" : "var(--action)",
            textDecoration: "underline",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {tastingNoteSet.has(item.item_code) ? "T-note" : "T-note(x)"}
        </a>
      ) : col.key === "image_url" && item.image_url ? (
        <a
          href={item.image_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-block' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image_url}
            alt={item.product_name || ''}
            style={{
              width: 48,
              height: 48,
              objectFit: 'contain',
              background: '#fff',
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
            }}
            loading="lazy"
          />
        </a>
      ) : (
        formatted
      )}
    </td>
  );
}

