import { useCallback, useRef } from 'react';

/**
 * 긴 누름(long-press) 핸들러.
 *  - delay(기본 500ms) 동안 포인터가 유지되면 onLongPress 트리거
 *  - 트리거되면 곧이은 click 한 번을 무시 (data 속성 플래그로 표시)
 *  - 5px 이상 이동하면 취소
 */
export function useLongPress(
  onLongPress: () => void,
  options?: { delay?: number; moveTolerance?: number },
) {
  const delay = options?.delay ?? 500;
  const moveTolerance = options?.moveTolerance ?? 5;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const triggered = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    startPos.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 우클릭/마우스 보조 버튼은 무시
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      triggered.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        triggered.current = true;
        timer.current = null;
        onLongPress();
      }, delay);
    },
    [delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current || !timer.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (dx * dx + dy * dy > moveTolerance * moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  const onPointerUp = useCallback(() => clear(), [clear]);
  const onPointerLeave = useCallback(() => clear(), [clear]);
  const onPointerCancel = useCallback(() => clear(), [clear]);

  // long-press 직후 발생하는 click을 삼키는 핸들러
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (triggered.current) {
      e.preventDefault();
      e.stopPropagation();
      triggered.current = false;
    }
  }, []);

  // 모바일 컨텍스트 메뉴 방지 (긴 누름 시 OS 메뉴 표시 회피)
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (triggered.current || timer.current) {
      e.preventDefault();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel, onClickCapture, onContextMenu };
}
