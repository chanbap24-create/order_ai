import { useState } from "react";
import type { TastingWineRow } from "../types";

export type PipelineProgress = { current: number; total: number; phase: string; name: string };

/**
 * 신규 와인 일괄 파이프라인: AI 리서치(노트 생성) → PPTX 발행 → PDF 발행 → 인덱스 갱신.
 * github-release 가 DB 노트로 PPT/PDF 를 재생성해 업로드하므로 별도 generate-ppt 불필요.
 * 발행은 리서치 완료(노트 DB 기록) 후에 수행한다.
 */
export function useNewWinePipeline(opts: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress>({ current: 0, total: 0, phase: "", name: "" });
  const [result, setResult] = useState<string | null>(null);

  const run = async (rows: TastingWineRow[]) => {
    if (running || rows.length === 0) return;
    if (!confirm(
      `${rows.length}개 와인을 일괄 처리합니다.\n` +
      `AI 리서치(노트 생성) → PPTX·PDF 발행 → 인덱스 갱신.\n` +
      `AI 조사 API 비용이 발생합니다. 진행할까요?`,
    )) return;

    setRunning(true);
    setResult(null);
    const made: string[] = [];
    const failed: string[] = [];

    // 1) 와인별 AI 리서치(노트 DB 기록)
    for (let i = 0; i < rows.length; i++) {
      const w = rows[i];
      setProgress({ current: i + 1, total: rows.length, phase: "AI 리서치", name: w.item_name_kr || w.item_name_en || w.item_code });
      if (!w.item_name_en?.trim()) { failed.push(`${w.item_code}(영문명 없음)`); continue; }
      try {
        const res = await fetch("/api/admin/wine-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wine_id: w.item_code,
            product_name_eng: w.item_name_en || "",
            item_name_kr: w.item_name_kr || "",
            vintage: w.vintage || "",
            supplier: w.supplier || w.supplier_kr || "",
          }),
        });
        if (!res.ok) { failed.push(`${w.item_code}(리서치 실패)`); continue; }
        made.push(w.item_code);
      } catch {
        failed.push(`${w.item_code}(리서치 오류)`);
      }
    }

    let uploaded = 0;
    if (made.length) {
      // 2) PPTX 발행(릴리스 업로드 — DB 노트로 재생성)
      setProgress({ current: made.length, total: made.length, phase: "발행(PPTX)", name: "" });
      await fetch("/api/admin/github-release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: made, format: "pptx" }),
      }).catch(() => {});

      // 3) PDF 발행
      setProgress({ current: made.length, total: made.length, phase: "발행(PDF)", name: "" });
      const pdfRes = await fetch("/api/admin/github-release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineIds: made, format: "pdf" }),
      }).then((r) => r.json()).catch(() => null);
      uploaded = pdfRes?.uploaded ?? made.length;

      // 4) 인덱스 갱신(GitHub Actions)
      setProgress({ current: made.length, total: made.length, phase: "인덱스 갱신", name: "" });
      await fetch("/api/admin/github-dispatch", { method: "POST" }).catch(() => {});
    }

    setRunning(false);
    setProgress({ current: 0, total: 0, phase: "", name: "" });
    setResult(
      `완료: 노트 ${made.length}개 생성 · 발행 ${uploaded}개 · 인덱스 갱신 요청` +
      (failed.length ? ` · ${failed.length}개 건너뜀(${failed.slice(0, 3).join(", ")}${failed.length > 3 ? " 외" : ""})` : ""),
    );
    opts.onDone();
  };

  return { running, progress, result, run };
}
