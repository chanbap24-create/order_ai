'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ClientRow, ListType, SortDir, SortKey } from '../types';
import { getPresetRange } from '../lib/format';

type Args = { currentManager: string; isAdmin: boolean };

export function useClientList({ currentManager, isAdmin }: Args) {
  const [preset, setPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [type, setType] = useState<ListType>('wine');
  const [managerFilter, setManagerFilter] = useState(currentManager);
  const [managerList, setManagerList] = useState<string[]>([]);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [businessTypes, setBusTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalClients, setTotalClients] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalSupply, setTotalSupply] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey>('period_total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const [s, e] = getPresetRange('thisMonth');
    setStartDate(s);
    setEndDate(e);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/sales/clients/managers').then(r => r.json()).then(d => {
        if (d.managers) setManagerList(d.managers);
      }).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (preset !== 'custom') {
      const [s, e] = getPresetRange(preset);
      setStartDate(s);
      setEndDate(e);
    }
  }, [preset]);

  useEffect(() => {
    if (!startDate || !endDate || !managerFilter) return;
    setLoading(true);
    const params = new URLSearchParams({
      manager: managerFilter, start: startDate, end: endDate, type,
    });
    if (businessType) params.set('business_type', businessType);
    fetch(`/api/sales/client-list?${params}`)
      .then(r => r.json())
      .then(d => {
        setClients(d.clients || []);
        setBusTypes(d.businessTypes || []);
        setTotalClients(d.totalClients || 0);
        setTotalAmount(d.totalAmount || 0);
        setTotalSupply(d.totalSupply || 0);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [startDate, endDate, managerFilter, businessType, type]);

  const sortedClients = useMemo(() => {
    const arr = [...clients];
    arr.sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va);
      vb = String(vb);
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return arr;
  }, [clients, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'client_name' || key === 'business_type' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return {
    preset, setPreset,
    startDate, setStartDate, endDate, setEndDate,
    type, setType, businessType, setBusinessType,
    managerFilter, setManagerFilter, managerList,
    clients: sortedClients, businessTypes,
    loading, totalClients, totalAmount, totalSupply,
    sortKey, sortDir, handleSort, sortIcon,
  };
}
