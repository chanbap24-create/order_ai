import { useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../constants";

/**
 * 자동 붙여넣기(클립보드) 훅.
 * - localStorage로 ON/OFF 유지
 * - autoPaste ON이고 아직 실행된 적 없으며 current가 비어있으면 클립보드 텍스트를 채움
 */
export function useAutoPaste(current: string, setText: (v: string) => void) {
  const [autoPaste, setAutoPaste] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.autoPaste) === "1";
    }
    return false;
  });
  const ran = useRef(false);

  useEffect(() => {
    if (autoPaste && !ran.current && !current) {
      ran.current = true;
      navigator.clipboard
        .readText()
        .then((t) => {
          if (t?.trim()) setText(t.trim());
        })
        .catch(() => {});
    }
  }, [autoPaste, current, setText]);

  const toggle = () => {
    const next = !autoPaste;
    setAutoPaste(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.autoPaste, next ? "1" : "0");
    }
  };

  return { autoPaste, toggle };
}
