import {
  learnClientAlias,
  learnItemAlias,
  learnNewItem,
  parseWineOrder,
} from "../lib/api";
import { applySuggestionToResult } from "../lib/applySuggestion";
import { copyToClipboard, decorateStaffMessage } from "../lib/staffMessage";
import type { ParseResult, Suggestion } from "../types";
import { COPY_FEEDBACK_MS } from "../constants";

/**
 * Wine 페이지 핸들러 팩토리.
 * 상태/setter는 주입받고 핸들러 집합을 반환한다.
 */
export type WineHandlersDeps = {
  text: string;
  clientInput: string;
  force: boolean;
  data: ParseResult | null;
  pendingPreMessage: string;
  newBusinessEnabled: boolean;
  newBusinessValid: () => boolean;
  newBusinessPayload: () => any;
  getApiFlags: () => any;
  getDecorateOptions: () => {
    customDeliveryDate: string;
    requirePaymentConfirm: boolean;
    requireInvoice: boolean;
  };
  setText: (v: string) => void;
  setClientInput: (v: string) => void;
  setData: (v: any | ((prev: any) => any)) => void;
  setLoading: (v: boolean) => void;
  setCopied: (v: boolean) => void;
  setShowJson: (v: boolean) => void;
  setShowItemsPanel: (v: boolean) => void;
  setShowLearnInput: (v: boolean) => void;
  setClientCandidates: (v: any[] | null) => void;
  setPendingOrderText: (v: string) => void;
  setPendingPreMessage: (v: string) => void;
  setSavingPick: (
    u: (p: Record<number, boolean>) => Record<number, boolean>,
  ) => void;
  setSavedPick: (
    u: (p: Record<number, boolean>) => Record<number, boolean>,
  ) => void;
  setLearnedClientVersion: (u: (v: number) => number) => void;
  setLearnedVersion: (u: (v: number) => number) => void;
  setShowLearned: (v: boolean) => void;
};

export function createWineOrderHandlers(d: WineHandlersDeps) {
  async function run() {
    d.setLoading(true);
    d.setData(null);
    d.setShowJson(false);
    d.setClientCandidates(null);
    d.setPendingOrderText("");
    d.setPendingPreMessage("");

    try {
      const baseFlags = d.getApiFlags();

      if (d.newBusinessEnabled) {
        if (!d.newBusinessValid()) {
          alert("신규 사업자의 사업자명과 연락처를 입력해주세요.");
          d.setLoading(false);
          return;
        }
        const json = await parseWineOrder({
          message: d.text,
          force_resolve: true,
          ...baseFlags,
          newBusiness: d.newBusinessPayload(),
        });
        d.setData(json);
        d.setSavingPick(() => ({}));
        d.setSavedPick(() => ({}));
        d.setCopied(false);
        d.setLoading(false);
        return;
      }

      const finalMessage = d.clientInput.trim()
        ? `${d.clientInput.trim()}\n${d.text}`
        : d.text;

      const json = await parseWineOrder({
        message: finalMessage,
        force_resolve: d.force,
        ...baseFlags,
      });
      d.setData(json);
      d.setSavingPick(() => ({}));
      d.setSavedPick(() => ({}));
      d.setCopied(false);

      if (json?.status === "needs_review_client") {
        const cands = Array.isArray(json?.client?.candidates)
          ? json.client.candidates
          : [];
        d.setClientCandidates(cands);
        d.setPendingOrderText(String(json?.debug?.orderText ?? ""));
        d.setPendingPreMessage(String(json?.debug?.preprocessed_message ?? d.text));
        d.setShowLearnInput(false);
      }
    } catch (err: any) {
      alert(err?.message || "발주 분석 중 오류가 발생했습니다.");
    } finally {
      d.setLoading(false);
    }
  }

  async function pickClient(c: any) {
    const clientName = String(c?.client_name ?? "").trim();
    const clientCode = String(c?.client_code ?? "").trim();
    if (!clientName || !clientCode) return;

    d.setLoading(true);
    try {
      const firstLineText = (d.pendingPreMessage || d.text).split("\n")[0].trim();
      if (firstLineText && firstLineText !== clientName) {
        try {
          await learnClientAlias({ client_code: clientCode, alias: firstLineText });
          d.setLearnedClientVersion((v) => v + 1);
        } catch (err) {
          console.error("거래처 학습 실패:", err);
        }
      }

      const json = await parseWineOrder({
        message: d.pendingPreMessage || d.text,
        resolvedClientCode: clientCode,
        resolvedClientName: clientName,
        force_resolve: d.force,
        ...d.getApiFlags(),
      });
      d.setData(json);
      d.setClientCandidates(null);
      d.setPendingOrderText("");
      d.setPendingPreMessage("");
      d.setSavingPick(() => ({}));
      d.setSavedPick(() => ({}));
      d.setCopied(false);
    } finally {
      d.setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) d.setText(clip);
    } catch {
      alert("클립보드 접근 권한이 필요합니다.");
    }
  }

  function clearAll() {
    d.setText("");
    d.setClientInput("");
    d.setData(null);
    d.setCopied(false);
    d.setShowJson(false);
    d.setSavingPick(() => ({}));
    d.setSavedPick(() => ({}));
    d.setLoading(false);
    d.setClientCandidates(null);
    d.setPendingOrderText("");
    d.setPendingPreMessage("");
    d.setShowItemsPanel(false);
    d.setShowLearnInput(false);
  }

  async function copyStaffMessage() {
    const base = String(d.data?.staff_message ?? "");
    if (!base) {
      alert("복사할 내용이 없습니다.");
      return;
    }
    const msg = decorateStaffMessage(base, d.getDecorateOptions());
    await copyToClipboard(msg);
    d.setCopied(true);
    setTimeout(() => d.setCopied(false), COPY_FEEDBACK_MS);
  }

  function applySuggestionToResultUI(
    itemIndex: number,
    s: Suggestion,
    supplyPrice?: string,
  ) {
    d.setData((prev: any) => applySuggestionToResult(prev, itemIndex, s, supplyPrice));
  }

  async function learnSelectedAlias(
    itemIndex: number,
    s: Suggestion,
    supplyPrice?: string,
  ) {
    const it = (Array.isArray(d.data?.items) ? d.data!.items! : [])[itemIndex];
    const alias = String(it?.name || it?.raw || "").trim();
    const canonical = String(s?.item_no || "").trim();
    const isNewItem = !!it?.is_new_item;

    if (!alias || !canonical) {
      alert("학습에 필요한 값이 비어있습니다.");
      return false;
    }
    if (isNewItem && !supplyPrice) {
      alert("신규 품목은 공급가를 입력해주세요.");
      return false;
    }

    d.setSavingPick((p) => ({ ...p, [itemIndex]: true }));
    d.setSavedPick((p) => ({ ...p, [itemIndex]: false }));

    try {
      let result;
      if (isNewItem && supplyPrice) {
        result = await learnNewItem({
          clientCode: d.data?.client?.client_code || "",
          selectedItemNo: canonical,
          selectedName: s?.item_name || "",
          supplyPrice: parseInt(supplyPrice, 10),
        });
      } else {
        const clientCode = d.data?.client?.client_code || "*";
        result = await learnItemAlias({ alias, canonical, client_code: clientCode });
      }

      if (!result.ok) {
        alert(`학습 실패:\n${alias} → ${canonical}\n${result.error ?? ""}`);
        return false;
      }
      d.setLearnedVersion((v) => v + 1);
      d.setShowLearned(true);
      d.setSavedPick((p) => ({ ...p, [itemIndex]: true }));
      return true;
    } finally {
      d.setSavingPick((p) => ({ ...p, [itemIndex]: false }));
    }
  }

  return {
    run,
    pickClient,
    pasteFromClipboard,
    clearAll,
    copyStaffMessage,
    applySuggestionToResultUI,
    learnSelectedAlias,
  };
}
