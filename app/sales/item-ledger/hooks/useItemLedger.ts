'use client';

import { useCallback, useState } from 'react';
import type { ClientSummary, ItemRow, SearchItem, Totals, Warehouse } from '../types';

type Args = {
  selectedItem: SearchItem | null;
  startDate: string;
  endDate: string;
  warehouse: Warehouse;
};

export function useItemLedger({ selectedItem, startDate, endDate, warehouse }: Args) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
  const [itemName, setItemName] = useState('');
  const [totals, setTotals] = useState<Totals>({ qty: 0, supply: 0, clients: 0 });
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!selectedItem) { setError('품목을 선택해주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        item_no: selectedItem.item_no,
        start_date: startDate,
        end_date: endDate,
        warehouse,
      });
      const res = await fetch(`/api/sales/item-ledger?${params}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRows(data.rows || []);
      setClientSummary(data.client_summary || []);
      setItemName(data.item_name || selectedItem.item_name);
      setTotals(data.totals || { qty: 0, supply: 0, clients: 0 });
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedItem, startDate, endDate, warehouse]);

  const clearResults = () => {
    setRows([]);
    setClientSummary([]);
    setItemName('');
    setTotals({ qty: 0, supply: 0, clients: 0 });
  };

  return {
    loading, rows, clientSummary, itemName, totals, error,
    handleSearch, clearResults,
  };
}
