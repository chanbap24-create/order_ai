'use client';

import { useEffect, useState } from 'react';

export function useManagers(isAdmin: boolean) {
  const [managers, setManagers] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/sales/clients/managers');
        const data = await res.json();
        setManagers(data.managers || []);
      } catch { /* ignore */ }
    })();
  }, [isAdmin]);

  return managers;
}
