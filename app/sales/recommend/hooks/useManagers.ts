'use client';

import { useEffect, useState } from 'react';

export function useManagers(isAdmin: boolean) {
  const [managers, setManagers] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/sales/clients/managers')
      .then(r => r.json())
      .then(d => { if (d.managers) setManagers(d.managers); })
      .catch(() => {});
  }, [isAdmin]);

  return managers;
}
