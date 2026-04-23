import { useRef, useState } from "react";
import type { ExpenseItem, ParseResult } from "../types";

type Params = {
  onItemAdded: () => void;
};

/** 파싱 결과 편집 + 항목 큐(아직 저장 전) 관리 */
export function useItemForm(p: Params) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("복리후생비");
  const [editNote, setEditNote] = useState("");
  const [editKm, setEditKm] = useState("");
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const applyParseResult = (r: ParseResult) => {
    setParseResult(r);
    setEditDate(r.date || "");
    setEditDesc(r.description || "");
    setEditAmount(r.amount != null ? String(r.amount) : "");
    setEditCategory(r.account_category || "복리후생비");
    setEditNote("");
  };

  const resetForm = () => {
    setParseResult(null);
    setEditDate("");
    setEditDesc("");
    setEditAmount("");
    setEditCategory("복리후생비");
    setEditNote("");
    setEditKm("");
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const startManualEntry = () => {
    if (!editDate) {
      const now = new Date();
      setEditDate(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      );
    }
  };

  const addItem = () => {
    if (!editDate || !editDesc || !editAmount) {
      alert("일자, 내역, 금액을 모두 입력해주세요.");
      return;
    }
    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      date: editDate,
      description: editDesc,
      amount: Number(editAmount) || 0,
      account_category: editCategory,
      km: editKm ? Number(editKm) : undefined,
      note: editNote || undefined,
    };
    setItems((prev) => [...prev, newItem]);
    p.onItemAdded();
    resetForm();
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearItems = () => setItems([]);

  return {
    parseResult, setParseResult,
    editDate, setEditDate,
    editDesc, setEditDesc,
    editAmount, setEditAmount,
    editCategory, setEditCategory,
    editNote, setEditNote,
    editKm, setEditKm,
    items, addItem, removeItem, clearItems,
    applyParseResult, resetForm, startManualEntry,
    receiptInputRef,
  };
}
