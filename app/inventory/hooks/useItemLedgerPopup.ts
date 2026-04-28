'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WarehouseTab } from '../types';
import type { ClientSummary, ItemRow, Totals } from '@/app/sales/item-ledger/types';
import { todayKst } from '@/app/lib/dateKst';

type Range = { start: string; end: string; label: string };

export function getDefaultRanges(): Range[] {
  const today = todayKst();
  const [y, mStr] = today.split('-');
  const yi = Number(y), mi = Number(mStr) - 1;
  const six = new Date(Date.UTC(yi, mi - 5, 1));
  const sixStart = `${six.getUTCFullYear()}-${String(six.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return [
    { label: '최근 6개월', start: sixStart, end: today },
    { label: '올해', start: `${y}-01-01`, end: today },
    { label: '작년부터', start: `${yi - 1}-01-01`, end: today },
    { label: '전체', start: '2020-01-01', end: today },
  ];
}

type Args = { warehouse: WarehouseTab };

export function useItemLedgerPopup({ warehouse }: Args) {
  const ranges = getDefaultRanges();
  const [open, setOpen] = useState(false);
  const [itemNo, setItemNo] = useState<string | null>(null);
  const [itemNameLocal, setItemNameLocal] = useState('');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'date' | 'client'>('client');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
  const [totals, setTotals] = useState<Totals>({ qty: 0, supply: 0, clients: 0 });
  const [itemNameFromApi, setItemNameFromApi] = useState('');

  const fetchData = useCallback(async (no: string, r: Range) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        item_no: no,
        start_date: r.start,
        end_date: r.end,
        warehouse,
      });
      const res = await fetch(`/api/sales/item-ledger?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '조회 실패');
        setRows([]); setClientSummary([]); setTotals({ qty: 0, supply: 0, clients: 0 });
        return;
      }
      setRows(data.rows || []);
      setClientSummary(data.client_summary || []);
      setTotals(data.totals || { qty: 0, supply: 0, clients: 0 });
      setItemNameFromApi(data.item_name || '');
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [warehouse]);

  const openFor = useCallback((no: string, name: string) => {
    setItemNo(no);
    setItemNameLocal(name);
    setOpen(true);
    setRangeIdx(0);
    fetchData(no, ranges[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const close = useCallback(() => {
    setOpen(false);
    setItemNo(null);
    setError('');
    setRows([]);
    setClientSummary([]);
    setTotals({ qty: 0, supply: 0, clients: 0 });
  }, []);

  const selectRange = useCallback((idx: number) => {
    if (!itemNo) return;
    setRangeIdx(idx);
    fetchData(itemNo, ranges[idx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemNo, fetchData]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return {
    open,
    itemNo,
    itemName: itemNameFromApi || itemNameLocal,
    ranges,
    rangeIdx,
    viewMode,
    setViewMode,
    selectRange,
    loading,
    error,
    rows,
    clientSummary,
    totals,
    openFor,
    close,
  };
}
