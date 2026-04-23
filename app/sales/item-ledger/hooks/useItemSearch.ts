'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchItem, Warehouse } from '../types';

export function useItemSearch(warehouse: Warehouse) {
  const [itemSearch, setItemSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setItemSearch(val);
    setSelectedItem(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sales/item-search?q=${encodeURIComponent(val)}&warehouse=${warehouse}`);
        const data = await res.json();
        if (data.items) {
          setSuggestions(data.items);
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
  }, [warehouse]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectItem = (item: SearchItem) => {
    setSelectedItem(item);
    setItemSearch(item.item_name);
    setShowSuggestions(false);
  };

  const reset = () => {
    setSelectedItem(null);
    setItemSearch('');
    setSuggestions([]);
  };

  return {
    itemSearch, suggestions, showSuggestions, selectedItem, searchRef,
    handleSearchChange, selectItem, setShowSuggestions, reset,
  };
}
