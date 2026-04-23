'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerType, SuggestionItem } from '../types';

type Client = { client_code: string; client_name: string; client_type?: string };

export function useClientSearch(type: LedgerType) {
  const [clientSearch, setClientSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SuggestionItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setClientSearch(val);
    setSelectedClient(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sales/clients?search=${encodeURIComponent(val)}&limit=15&type=${type}`);
        const data = await res.json();
        if (data.clients) {
          setSuggestions(data.clients.map((c: Client) => ({
            code: c.client_code, name: c.client_name, type: c.client_type,
          })));
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
  }, [type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectClient = (item: SuggestionItem) => {
    setSelectedClient(item);
    setClientSearch(item.name);
    setShowSuggestions(false);
  };

  const reset = () => {
    setClientSearch('');
    setSelectedClient(null);
    setSuggestions([]);
  };

  return {
    clientSearch, suggestions, showSuggestions, selectedClient, searchRef,
    handleSearchChange, selectClient, setShowSuggestions, reset,
  };
}
