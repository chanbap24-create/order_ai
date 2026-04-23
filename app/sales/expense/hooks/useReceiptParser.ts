import { useState } from "react";
import type { ParseResult } from "../types";
import { compressImage } from "../lib/image";

type Params = {
  currentManager: string;
  onParsed: (result: ParseResult) => void;
};

/** 영수증 이미지 업로드 + AI 파싱 */
export function useReceiptParser(p: Params) {
  const [receiptPreview, setReceiptPreview] = useState("");
  const [parsing, setParsing] = useState(false);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const base64 = await compressImage(file);
      setReceiptPreview(base64);

      const res = await fetch("/api/sales/expense/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, manager: p.currentManager }),
      });
      const data = await res.json();
      if (data.error) {
        alert("파싱 실패: " + data.error);
      } else {
        p.onParsed(data);
      }
    } catch {
      alert("서버 연결 실패");
    } finally {
      setParsing(false);
    }
  };

  const clearPreview = () => setReceiptPreview("");

  return { receiptPreview, clearPreview, parsing, handleReceiptUpload };
}
