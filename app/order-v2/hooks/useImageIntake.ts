import { useCallback, useState } from "react";
import { extractFromImage, type IntakeResult } from "../lib/api";
import { fileToBase64 } from "../lib/imageFile";
import type { OrderTab } from "../types";

/**
 * 카톡 스크린샷 → 거래처+발주 추출 훅.
 * onResult: 추출 성공 시 호출 (페이지가 거래처/발주텍스트 채움).
 * tab: 담당자 거래처 스코프(서버에서 LLM 거래처 선택에 사용).
 */
export function useImageIntake(onResult: (r: IntakeResult) => void, tab: OrderTab) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 가능합니다.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, mediaType } = await fileToBase64(file);
        const result = await extractFromImage(data, mediaType, tab);
        if (!result.found) {
          setError(result.error || "발주 내용을 찾지 못했습니다.");
          return;
        }
        onResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "이미지 분석 실패");
      } finally {
        setLoading(false);
      }
    },
    [onResult, tab],
  );

  return { processFile, loading, error, clearError: () => setError(null) };
}
