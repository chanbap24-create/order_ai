'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientOption } from '../types';

export function useClientSearch(filterManager: string, preselected?: ClientOption | null) {
  const [clientSearch, setClientSearch] = useState(preselected?.client_name || '');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(preselected || null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextSearch = useRef(false); // 거래처 선택 시 검색창 값 변경으로 드롭다운 재오픈 방지

  const searchClients = useCallback(async (q: string) => {
    setClientLoading(true);
    try {
      const params = new URLSearchParams({ search: q, limit: '50', type: 'wine' });
      if (filterManager) params.set('manager', filterManager);
      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      setClientOptions(json.clients || []);
      setShowDropdown(true);
    } catch {
      setClientOptions([]);
    } finally {
      setClientLoading(false);
    }
  }, [filterManager]);

  useEffect(() => {
    // 거래처 선택 직후엔 검색을 건너뜀(선택으로 바뀐 검색창 값이 드롭다운을 다시 열지 않게)
    if (suppressNextSearch.current) { suppressNextSearch.current = false; return; }
    // 입력값이 이미 선택된 거래처명 그대로면 검색/드롭다운 열기 건너뜀
    // (탭 전환·담당자필터 변경 등 재렌더 시 자동으로 열리는 것 방지). 새로 타이핑하면 selectedClient가 풀려 정상 검색.
    if (selectedClient && clientSearch === selectedClient.client_name) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (clientSearch.length >= 1) {
      searchTimer.current = setTimeout(() => searchClients(clientSearch), 300);
    } else {
      setClientOptions([]);
      setShowDropdown(false);
    }
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [clientSearch, searchClients, selectedClient]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectClient = (c: ClientOption) => {
    suppressNextSearch.current = true;
    setSelectedClient(c);
    setClientSearch(c.client_name);
    setShowDropdown(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientSearch('');
  };

  return {
    clientSearch, setClientSearch,
    clientOptions, clientLoading,
    showDropdown, setShowDropdown,
    selectedClient, setSelectedClient, selectClient, clearClient,
    dropdownRef,
  };
}
