'use client';

import { useEffect, useState } from 'react';
import type { WarehouseTab, InvColumnKey, QuoteColumnKey, QuoteColumnConfig, DocSettings } from '../types';
import { INV_COLUMNS, DEFAULT_INV_CDV, DEFAULT_INV_DL, QUOTE_COLUMNS, DEFAULT_QUOTE_VISIBLE } from '../constants/columns';
import { CDV_DOC_DEFAULTS } from '../constants/docDefaults';
import { CACHE_TTL, getCached, setCached } from '@/app/lib/sessionCache';

/** 인벤토리 페이지의 탭·컬럼·문서설정 상태 + 국가 목록 로드 + 파생 컬럼 계산 (page.tsx에서 분리) */
export function useInventoryPageState() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('CDV');
  const [countryList, setCountryList] = useState<string[]>([]);
  const [visibleColumnsCDV, setVisibleColumnsCDV] = useState<InvColumnKey[]>(DEFAULT_INV_CDV);
  const [visibleColumnsDL, setVisibleColumnsDL] = useState<InvColumnKey[]>(DEFAULT_INV_DL);
  const [visibleQuoteColumns, setVisibleQuoteColumns] = useState<QuoteColumnKey[]>(DEFAULT_QUOTE_VISIBLE);
  const [docSettings, setDocSettings] = useState<DocSettings>(CDV_DOC_DEFAULTS);

  // 국가 목록 — 세션 캐시 우선 표시 후 백그라운드 갱신
  useEffect(() => {
    const cacheKey = `inventory_countries_${activeTab}`;
    const cached = getCached<string[]>(cacheKey, CACHE_TTL.COUNTRIES);
    if (cached) setCountryList(cached);

    fetch(`/api/inventory/countries?tab=${activeTab}`)
      .then(r => r.json())
      .then(d => {
        const list = d.countries || [];
        setCountryList(list);
        setCached(cacheKey, list);
      })
      .catch(() => {});
  }, [activeTab]);

  // 파생 컬럼
  const invColumnOrder = INV_COLUMNS.map(c => c.key);
  const rawInvVisible = activeTab === 'CDV' ? visibleColumnsCDV : visibleColumnsDL;
  const visibleInvColumns = [...new Set(rawInvVisible)].sort(
    (a, b) => invColumnOrder.indexOf(a) - invColumnOrder.indexOf(b),
  );
  const availableInvColumns = INV_COLUMNS.filter(col => {
    if (activeTab === 'CDV') return !col.dlOnly;
    if (activeTab === 'DL') return !col.cdvOnly;
    return true;
  });
  const visibleQuoteCols = visibleQuoteColumns
    .map(key => QUOTE_COLUMNS.find(c => c.key === key))
    .filter(Boolean) as QuoteColumnConfig[];

  return {
    activeTab, setActiveTab,
    countryList,
    visibleColumnsCDV, setVisibleColumnsCDV,
    visibleColumnsDL, setVisibleColumnsDL,
    visibleQuoteColumns, setVisibleQuoteColumns,
    docSettings, setDocSettings,
    visibleInvColumns, availableInvColumns, visibleQuoteCols,
  };
}
