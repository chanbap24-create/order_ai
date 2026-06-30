import { useCallback, useEffect, useRef, useState } from "react";
import { extractFromImage, fetchClients, learnOrderCorrections } from "../lib/api";
import { pickClientWithFuzzy } from "../lib/clientMatch";
import { allLinesReady } from "../lib/confidence";
import { fileToBase64 } from "../lib/imageFile";
import type { AutoResult } from "./useOrderBatch";
import type { Client, OrderLine, OrderTab } from "../types";

type Deps = {
  tab: OrderTab;
  staffMessage: string;
  selectedClient: Client | null;
  parseLoading: boolean;
  orderLines: OrderLine[];
  setOrderText: (s: string) => void;
  setSelectedClient: (c: Client) => void;
  setClientQuery: (s: string) => void;
  resetDiscounts: () => void;
  closeSearch: () => void;
  runParse: (p: { tab: OrderTab; orderText: string; selectedClient: Client | null; clientQuery: string }) => Promise<boolean>;
};

const fail = (): AutoResult => ({ total: 1, ready: 0, attention: 1, copied: false, message: "" });

/**
 * 자동(단건): 스샷 1장 → 추출→거래처매칭→파싱 → 예전처럼 상세 편집뷰에 결과 표시.
 * 파싱 완료 후 모든 라인이 확실 + 거래처 선택이면 자동 복사 + 학습.
 * (상세 편집뷰는 그대로 떠 있어 사용자가 최종 수정 가능)
 */
export function useAutoSingle(d: Deps) {
  const [autoBusy, setAutoBusy] = useState(false);
  const [result, setResult] = useState<AutoResult | null>(null);
  const activeRef = useRef(false);
  const clear = useCallback(() => setResult(null), []);

  const run = useCallback(
    async (file: File) => {
      setResult(null);
      activeRef.current = true;
      setAutoBusy(true);
      try {
        const { data, mediaType } = await fileToBase64(file);
        const ex = await extractFromImage(data, mediaType, d.tab);
        if (!ex.found) { activeRef.current = false; setResult(fail()); return; }
        d.setOrderText(ex.order_text);
        let selected: Client | null = null;
        // LLM이 담당자 거래처에서 고른 코드가 확신 높으면 우선, 아니면 힌트 퍼지 매칭
        if (ex.client_code && ex.client_name && (ex.client_confidence ?? 0) >= 0.75) {
          selected = { client_code: ex.client_code, client_name: ex.client_name } as Client;
        } else if (ex.client_hint) {
          try { selected = pickClientWithFuzzy(ex.client_hint, await fetchClients(ex.client_hint, d.tab)); } catch { /* 매칭 실패 */ }
        }
        if (selected) { d.setSelectedClient(selected); d.setClientQuery(selected.client_name); }
        else d.setClientQuery(ex.client_hint || "");
        d.resetDiscounts();
        d.closeSearch();
        const ok = await d.runParse({ tab: d.tab, orderText: ex.order_text, selectedClient: selected, clientQuery: ex.client_hint || "" });
        if (!ok) { activeRef.current = false; setResult(fail()); }
      } catch {
        activeRef.current = false;
        setResult(fail());
      } finally {
        setAutoBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.tab],
  );

  useEffect(() => {
    if (!activeRef.current || d.parseLoading || autoBusy) return;
    activeRef.current = false;
    if (allLinesReady(d.orderLines) && d.selectedClient) {
      navigator.clipboard.writeText(d.staffMessage).catch(() => {});
      learnOrderCorrections(d.orderLines);
      setResult({ total: 1, ready: 1, attention: 0, copied: true, message: d.staffMessage });
    } else {
      setResult(fail());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.parseLoading, autoBusy, d.orderLines, d.staffMessage]);

  return { run, autoBusy, result, clear };
}
