import { useCallback } from "react";
import type { DocSettings, InvColumnKey, QuoteColumnKey, WarehouseTab } from "../types";
import { DEFAULT_QUOTE_VISIBLE } from "../constants/columns";
import { CDV_DOC_DEFAULTS, DL_DOC_DEFAULTS } from "../constants/docDefaults";

type Params = {
  activeTab: WarehouseTab;
  setActiveTab: (t: WarehouseTab) => void;
  visibleColumnsCDV: InvColumnKey[];
  visibleColumnsDL: InvColumnKey[];
  setVisibleColumnsCDV: (c: InvColumnKey[]) => void;
  setVisibleColumnsDL: (c: InvColumnKey[]) => void;
  setVisibleQuoteColumns: (c: QuoteColumnKey[]) => void;
  setDocSettings: (d: DocSettings) => void;
  onTabSwitched?: () => void;
};

/**
 * 탭 전환 + 칼럼 토글 로직.
 * 탭 전환 시 해당 탭의 doc settings / quote columns를 localStorage에서 즉시 복원
 * (서버 prefs는 useInventoryPreferences가 백그라운드에서 동기화).
 */
export function useTabSwitch(p: Params) {
  const switchTab = useCallback(
    (tab: WarehouseTab) => {
      p.setActiveTab(tab);
      p.onTabSwitched?.();
      try {
        const saved = localStorage.getItem(`quote_doc_settings_${tab}`);
        if (saved) p.setDocSettings(JSON.parse(saved));
        else p.setDocSettings(tab === "CDV" ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS);
      } catch {
        p.setDocSettings(tab === "CDV" ? CDV_DOC_DEFAULTS : DL_DOC_DEFAULTS);
      }
      try {
        const savedQCols = localStorage.getItem(`quote_visible_columns_${tab}`);
        if (savedQCols) p.setVisibleQuoteColumns(JSON.parse(savedQCols));
        else p.setVisibleQuoteColumns(DEFAULT_QUOTE_VISIBLE);
      } catch {
        p.setVisibleQuoteColumns(DEFAULT_QUOTE_VISIBLE);
      }
    },
    [p],
  );

  const toggleInvColumn = useCallback(
    (key: InvColumnKey) => {
      if (key === "item_no" || key === "item_name") return;
      const current = p.activeTab === "CDV" ? p.visibleColumnsCDV : p.visibleColumnsDL;
      const setter = p.activeTab === "CDV" ? p.setVisibleColumnsCDV : p.setVisibleColumnsDL;
      const deduped = [...new Set(current)];
      setter(
        deduped.includes(key) ? deduped.filter((k) => k !== key) : [...deduped, key],
      );
    },
    [p],
  );

  return { switchTab, toggleInvColumn };
}
