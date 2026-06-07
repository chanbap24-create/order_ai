import { useEffect } from "react";
import { logger } from '@/app/lib/logger';
import type {
  DocSettings,
  InvColumnKey,
  QuoteColumnKey,
  WarehouseTab,
} from "../types";
import type { useServerPreferences } from "./useServerPreferences";

// preference keys (서버 + localStorage 공용)
export const PREF_KEYS = {
  invColumnsCDV: "inventory_columns_cdv",
  invColumnsDL: "inventory_columns_dl",
  quoteCompany: "quote_company",
  quoteDocSettings: (tab: WarehouseTab) => `quote_doc_settings_${tab}`,
  quoteVisibleColumns: (tab: WarehouseTab) => `quote_visible_columns_${tab}`,
} as const;

type PrefsHook = ReturnType<typeof useServerPreferences>;

type Setters = {
  setActiveTab: (tab: WarehouseTab) => void;
  setVisibleColumnsCDV: (cols: InvColumnKey[]) => void;
  setVisibleColumnsDL: (cols: InvColumnKey[]) => void;
  setVisibleQuoteColumns: (cols: QuoteColumnKey[]) => void;
  setDocSettings: (d: DocSettings) => void;
};

type Getters = {
  activeTab: WarehouseTab;
  visibleColumnsCDV: InvColumnKey[];
  visibleColumnsDL: InvColumnKey[];
  visibleQuoteColumns: QuoteColumnKey[];
  docSettings: DocSettings;
};

/**
 * Inventory 페이지의 7개 preference 키를 서버(prefs) + localStorage 캐시로 통합 관리.
 *
 * 3단계:
 *  1. 마운트 시: localStorage에서 즉시 로드 (깜빡임 방지)
 *  2. 서버 prefs 응답 도착 시: 서버 값으로 덮어씀
 *  3. 각 값 변경 시: setWithCache로 서버 + 캐시 동시 저장
 */
export function useInventoryPreferences(
  prefs: PrefsHook,
  setters: Setters,
  getters: Getters,
) {
  const prefsState = prefs.state;
  const {
    setActiveTab,
    setVisibleColumnsCDV,
    setVisibleColumnsDL,
    setVisibleQuoteColumns,
    setDocSettings,
  } = setters;

  const dedupe = (cols: InvColumnKey[]): InvColumnKey[] => [...new Set(cols)];

  // 1차: localStorage 즉시 로드
  useEffect(() => {
    try {
      const savedCDV = localStorage.getItem(PREF_KEYS.invColumnsCDV);
      const savedDL = localStorage.getItem(PREF_KEYS.invColumnsDL);
      if (savedCDV) try { setVisibleColumnsCDV(dedupe(JSON.parse(savedCDV))); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
      if (savedDL) try { setVisibleColumnsDL(dedupe(JSON.parse(savedDL))); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }

      const savedCompany = localStorage.getItem(PREF_KEYS.quoteCompany) as
        | WarehouseTab
        | null;
      const tab = savedCompany === "CDV" || savedCompany === "DL" ? savedCompany : "CDV";
      if (savedCompany === "CDV" || savedCompany === "DL") {
        setActiveTab(savedCompany);
        const savedDoc = localStorage.getItem(PREF_KEYS.quoteDocSettings(savedCompany));
        if (savedDoc) try { setDocSettings(JSON.parse(savedDoc)); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
      }

      const savedQCols = localStorage.getItem(PREF_KEYS.quoteVisibleColumns(tab));
      if (savedQCols) try { setVisibleQuoteColumns(JSON.parse(savedQCols)); } catch (e) { logger.debug('비치명적 실패(기본값·무시)', { error: String(e) }); }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2차: 서버 prefs 로드 완료 → 덮어쓰기
  useEffect(() => {
    if (prefsState !== "loaded") return;

    const invCDV = prefs.get<InvColumnKey[]>(PREF_KEYS.invColumnsCDV);
    if (invCDV && Array.isArray(invCDV)) setVisibleColumnsCDV(dedupe(invCDV));

    const invDL = prefs.get<InvColumnKey[]>(PREF_KEYS.invColumnsDL);
    if (invDL && Array.isArray(invDL)) setVisibleColumnsDL(dedupe(invDL));

    const company = prefs.get<WarehouseTab>(PREF_KEYS.quoteCompany);
    const tab: WarehouseTab =
      company === "CDV" || company === "DL" ? company : getters.activeTab;
    if (company === "CDV" || company === "DL") {
      setActiveTab(company);
      const doc = prefs.get<DocSettings>(PREF_KEYS.quoteDocSettings(company));
      if (doc) setDocSettings(doc);
    }

    const qCols = prefs.get<QuoteColumnKey[]>(PREF_KEYS.quoteVisibleColumns(tab));
    if (qCols && Array.isArray(qCols)) setVisibleQuoteColumns(qCols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsState]);

  // 3차: 개별 값 변경 시 서버 + 캐시 저장
  useEffect(() => {
    if (prefsState === "idle" || prefsState === "loading") return;
    prefs.setWithCache(
      PREF_KEYS.invColumnsCDV,
      [...new Set(getters.visibleColumnsCDV)],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getters.visibleColumnsCDV, prefsState]);

  useEffect(() => {
    if (prefsState === "idle" || prefsState === "loading") return;
    prefs.setWithCache(
      PREF_KEYS.invColumnsDL,
      [...new Set(getters.visibleColumnsDL)],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getters.visibleColumnsDL, prefsState]);

  useEffect(() => {
    if (prefsState === "idle" || prefsState === "loading") return;
    prefs.setWithCache(
      PREF_KEYS.quoteVisibleColumns(getters.activeTab),
      getters.visibleQuoteColumns,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getters.visibleQuoteColumns, getters.activeTab, prefsState]);

  useEffect(() => {
    if (prefsState === "idle" || prefsState === "loading") return;
    prefs.setWithCache(PREF_KEYS.quoteCompany, getters.activeTab);
    prefs.setWithCache(
      PREF_KEYS.quoteDocSettings(getters.activeTab),
      getters.docSettings,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getters.activeTab, getters.docSettings, prefsState]);
}
