'use client';

import { useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState('');
  const show = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };
  return { toast, show };
}
