import { useState } from "react";

/**
 * 거래처 품목 목록에서 품목을 직접 추가할 때 쓰이는 수량 입력 상태.
 */
export function useAddItem(appendLine: (line: string) => void) {
  const [target, setTarget] = useState<any>(null);
  const [qty, setQty] = useState("1");

  const start = (item: any) => {
    setTarget(item);
    setQty("1");
  };

  const cancel = () => setTarget(null);

  const confirm = () => {
    if (!target) return;
    const n = Number(qty);
    if (!n || isNaN(n) || n <= 0) return;
    appendLine(`${target.item_name} ${n}`);
    setTarget(null);
    setQty("1");
  };

  return { target, qty, setQty, start, cancel, confirm };
}
