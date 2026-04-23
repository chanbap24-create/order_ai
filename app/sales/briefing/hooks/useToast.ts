'use client';

import { useEffect, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return { toast, setToast };
}
