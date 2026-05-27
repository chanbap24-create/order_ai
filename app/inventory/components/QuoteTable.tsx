"use client";

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
  onMoveItem: (idx: number, dir: "up" | "down") => void;
  onDeleteItem: (id: number) => void;
  onReorderColumns: (
    updater: (prev: QuoteColumnConfig[]) => QuoteColumnConfig[],
  ) => void;
};

/** 데스크톱 견적 테이블 — Head/Body/Foot 조립 + 인라인 편집 */
export function QuoteTable(p: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <QuoteTableHead
          visibleQuoteCols={p.visibleQuoteCols}
          onReorderColumns={p.onReorderColumns}
        />
        <tbody>
          {p.quoteItems.map((item, idx) => (
            <Row
              key={item.id}
              item={item}
              idx={idx}
              isFirst={idx === 0}
              isLast={idx === p.quoteItems.length - 1}
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
              onMoveItem={p.onMoveItem}
              onDeleteItem={p.onDeleteItem}
            />
          ))}
        </tbody>
        <QuoteTableFoot
          visibleQuoteCols={p.visibleQuoteCols}
          totalQty={p.totalQty}
          totalNormal={p.totalNormal}
          totalDiscount={p.totalDiscount}
          totalRetailNormal={p.totalRetailNormal}
          totalRetailDiscount={p.totalRetailDiscount}
        />
      </table>
    </div>
  );
}

function Row({
  item,
  idx,
  isFirst,
  isLast,
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
  onMoveItem,
  onDeleteItem,
}: {
  item: QuoteItem;
  idx: number;
  isFirst: boolean;
  isLast: boolean;
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
  onMoveItem: (idx: number, dir: "up" | "down") => void;
  onDeleteItem: (id: number) => void;
}) {
  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td
        style={{
          ...qTdStyle,
          textAlign: "center",
          color: "#888",
          whiteSpace: "nowrap",
        }}
      >
        <MoveBtn onClick={() => onMoveItem(idx, "up")} disabled={isFirst} title="위로">
          ▲
        </MoveBtn>
        <span style={{ fontSize: 12, margin: "0 1px" }}>{idx + 1}</span>
        <MoveBtn onClick={() => onMoveItem(idx, "down")} disabled={isLast} title="아래로">
          ▼
        </MoveBtn>
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
      ) : (
        formatted
      )}
    </td>
  );
}

function MoveBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "#ddd" : "#666",
        fontSize: 12,
        padding: "0 2px",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
