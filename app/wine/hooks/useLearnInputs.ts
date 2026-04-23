import { useMemo, useState } from "react";
import { LEARN_INPUT_ROWS } from "../constants";
import { learnItemAlias } from "../lib/api";
import type { LearnRow } from "../types";

const emptyRows = () =>
  Array.from({ length: LEARN_INPUT_ROWS }, () => ({ alias: "", canonical: "" }));

/**
 * 5행 학습 입력 + 순차 저장 (wine).
 * - save 성공 시 onSaved 콜백
 */
export function useLearnInputs(onSaved?: () => void) {
  const [rows, setRows] = useState<LearnRow[]>(emptyRows);

  const canSave = useMemo(
    () => rows.some((r) => r.alias.trim() && r.canonical.trim()),
    [rows],
  );

  const setField = (index: number, key: keyof LearnRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const reset = () => setRows(emptyRows());

  const save = async (): Promise<boolean> => {
    const valid = rows
      .map((r) => ({ alias: r.alias.trim(), canonical: r.canonical.trim() }))
      .filter((r) => r.alias && r.canonical);

    if (valid.length === 0) {
      alert("자연어/정답을 1개 이상 입력하세요.");
      return false;
    }

    for (const r of valid) {
      const result = await learnItemAlias(r);
      if (!result.ok) {
        alert(`학습 실패: ${r.alias}\n${result.error ?? ""}`);
        return false;
      }
    }

    reset();
    onSaved?.();
    alert("학습 완료");
    return true;
  };

  return { rows, setField, reset, canSave, save };
}
