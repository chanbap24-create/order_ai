import { useEffect, useState } from "react";
import { CLIPBOARD_CHECK_INTERVAL_MS, STORAGE_KEYS } from "../constants";

type UseClipboardResult = {
  autoPaste: boolean;
  setAutoPaste: (next: boolean) => void;
  hasClipboard: boolean;
};

/**
 * 클립보드 자동 붙여넣기 훅 (wine 페이지용).
 * - autoPaste ON이면 마운트 시 최초 붙여넣기
 * - 주기 체크로 클립보드 존재 여부만 UI 배지에 반영
 */
export function useClipboard(onInitialPaste: (text: string) => void): UseClipboardResult {
  const [autoPasteState, setAutoPasteState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.autoPaste);
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const [hasClipboard, setHasClipboard] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const setAutoPaste = (next: boolean) => {
    setAutoPasteState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.autoPaste, String(next));
    }
  };

  useEffect(() => {
    if (!autoPasteState) return;
    let cancelled = false;
    (async () => {
      try {
        const clip = await navigator.clipboard.readText();
        if (cancelled) return;
        if (clip && clip.length > 0) {
          if (!autoLoaded) {
            onInitialPaste(clip);
            setAutoLoaded(true);
          }
          setHasClipboard(true);
        } else {
          setHasClipboard(false);
        }
      } catch {
        if (!cancelled) setHasClipboard(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPasteState, autoLoaded, onInitialPaste]);

  useEffect(() => {
    if (!autoPasteState) return;
    const check = async () => {
      try {
        const clip = await navigator.clipboard.readText();
        setHasClipboard(!!clip && clip.length > 0);
      } catch {
        setHasClipboard(false);
      }
    };
    const interval = setInterval(check, CLIPBOARD_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoPasteState]);

  return { autoPaste: autoPasteState, setAutoPaste, hasClipboard };
}
