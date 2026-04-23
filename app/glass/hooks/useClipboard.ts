import { useEffect, useState } from "react";
import { CLIPBOARD_CHECK_INTERVAL_MS, STORAGE_KEYS } from "../constants";

type UseClipboardResult = {
  /** 토글 가능한 자동 붙여넣기 ON/OFF (localStorage에 저장됨) */
  autoPaste: boolean;
  setAutoPaste: (next: boolean) => void;
  /** 클립보드에 내용이 있는지 (주기 체크) */
  hasClipboard: boolean;
  /** 현재 클립보드 내용을 즉시 가져오기 (실패 시 null) */
  readClipboard: () => Promise<string | null>;
};

/**
 * 클립보드 자동 붙여넣기 관련 상태/부수효과를 관리.
 * - 마운트 시 autoPaste가 true면 초기 붙여넣기
 * - autoPaste가 true인 동안 주기적으로 클립보드 존재 여부만 체크 (UI 배지용)
 *
 * @param onInitialPaste 최초 붙여넣기 시 페이지에 내용을 반영하는 콜백
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

  // 초기 자동 붙여넣기
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

  // 주기적 클립보드 존재 체크
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

  const readClipboard = async (): Promise<string | null> => {
    try {
      const clip = await navigator.clipboard.readText();
      return clip ?? null;
    } catch {
      return null;
    }
  };

  return {
    autoPaste: autoPasteState,
    setAutoPaste,
    hasClipboard,
    readClipboard,
  };
}
