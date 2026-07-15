'use client';

import { useCallback, useEffect, useState } from 'react';

export type GroupClient = { code: string; name: string };
export type ClientGroup = { id: number; name: string; clients: GroupClient[]; updated_at: string };

/** 거래처 그룹(즐겨찾기) — 영업사원 개인 소유, 법인별. 견적 보낼 거래처 묶음 관리. */
export function useClientGroups(clientType: string) {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/sales/client-groups?type=${clientType}`, { credentials: 'include' });
      const j = await r.json();
      setGroups(Array.isArray(j.groups) ? j.groups : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [clientType]);

  useEffect(() => { void reload(); }, [reload]);

  const create = async (name: string, clients: GroupClient[]): Promise<ClientGroup | null> => {
    const r = await fetch('/api/sales/client-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ name, clients, client_type: clientType }),
    });
    const j = await r.json();
    if (j.group) { setGroups((p) => [...p, j.group]); return j.group; }
    return null;
  };

  const update = async (id: number, patch: { name?: string; clients?: GroupClient[] }): Promise<boolean> => {
    const r = await fetch('/api/sales/client-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, ...patch, client_type: clientType }),
    });
    const j = await r.json();
    if (j.group) { setGroups((p) => p.map((g) => (g.id === id ? j.group : g))); return true; }
    return false;
  };

  const remove = async (id: number): Promise<boolean> => {
    const r = await fetch(`/api/sales/client-groups?id=${id}`, { method: 'DELETE', credentials: 'include' });
    const j = await r.json();
    if (j.ok) { setGroups((p) => p.filter((g) => g.id !== id)); return true; }
    return false;
  };

  return { groups, loading, reload, create, update, remove };
}
